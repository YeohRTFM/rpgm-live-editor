/*:
 * @target MV MZ
 * @plugindesc v1.1.0 Live runtime editor overlay for RPG Maker MV/MZ (F6).
 * @author RPG Maker Live Editor
 * @help
 * RPG Maker Live Editor v1.1.0
 * Install in js/plugins and enable in Plugin Manager.
 *
 * F6: toggle overlay. Escape: close unless a text/select field is focused.
 * Features: actors (level, HP/MP/TP, effective parameters), gold, items,
 * weapons, armors, actor equipment, learned skills, active states,
 * session snapshot/restore, snapshot comparison, keyboard/mouse isolation.
 *
 * Snapshot is in-memory only. Test on a copy of the game. Third-party plugins
 * may add custom data not covered by this editor.
 *
 * @param ToggleKey
 * @text Toggle key
 * @type string
 * @default F6
 *
 * @param IncludeEquipped
 * @text Include equipped items in inventory adjustments
 * @type boolean
 * @default false
 *
 * @param MaxGold
 * @text Maximum gold
 * @type number
 * @min 1
 * @default 99999999
 *
 * @param MaxItemCount
 * @text Maximum item count
 * @type number
 * @min 1
 * @default 999
 *
 * @param MaxLevel
 * @text Maximum actor level
 * @type number
 * @min 1
 * @default 99
 *
 * @param MaxParameter
 * @text Maximum effective parameter target
 * @type number
 * @min 1
 * @default 999999
 */

(() => {
  "use strict";

  const PLUGIN_NAME = "RPGLiveEditor";
  const raw = window.PluginManager && PluginManager.parameters
    ? PluginManager.parameters(PLUGIN_NAME) : {};
  const cfg = {
    toggleKey: String(raw.ToggleKey || "F6").toUpperCase(),
    includeEquipped: String(raw.IncludeEquipped || "false") === "true",
    maxGold: int(raw.MaxGold, 1, 2147483647, 99999999),
    maxItems: int(raw.MaxItemCount, 1, 999999, 999),
    maxLevel: int(raw.MaxLevel, 1, 9999, 99),
    maxParam: int(raw.MaxParameter, 1, 2147483647, 999999)
  };

  function int(value, min, max, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.trunc(n))) : fallback;
  }
  function safeName(v) { return String(v == null ? "" : v); }
  function esc(v) {
    return safeName(v).replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function ready() {
    try {
      return !!(window.DataManager && DataManager.isDatabaseLoaded() &&
        window.$gameParty && window.$gameActors && window.$gameSystem);
    } catch (_) { return false; }
  }
  function activeGame() {
    return ready() && $gameParty.members && $gameParty.members().length > 0;
  }
  function dbEntries(array) {
    return Array.isArray(array) ? array.filter(x => x && x.id && x.name) : [];
  }
  function objectFor(kind, id) {
    const arr = kind === "item" ? window.$dataItems :
      kind === "weapon" ? window.$dataWeapons :
      kind === "armor" ? window.$dataArmors : null;
    return arr && arr[Number(id)] || null;
  }
  function actorFor(id) {
    return window.$gameActors && $gameActors.actor(Number(id));
  }
  function textField(el) {
    if (!el) return false;
    const tag = String(el.tagName || "").toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || !!el.isContentEditable;
  }
  function engineName() {
    try { return `${Utils.RPGMAKER_NAME} ${Utils.RPGMAKER_VERSION}`; }
    catch (_) { return "RPG Maker MV/MZ"; }
  }
  const PARAMS = ["MHP", "MMP", "ATK", "DEF", "MAT", "MDF", "AGI", "LUK"];

  const Reader = {
    actors() {
      return dbEntries(window.$dataActors).map(data => {
        const a = actorFor(data.id);
        if (!a) return null;
        const cls = window.$dataClasses && $dataClasses[a._classId];
        return {
          id: data.id, name: a.name ? a.name() : data.name,
          className: cls ? cls.name : "",
          level: a.level, hp: a.hp, mp: a.mp, tp: a.tp,
          mhp: a.mhp, mmp: a.mmp,
          params: PARAMS.map((label, i) => ({ id: i, label, value: a.param(i),
            plus: a._paramPlus ? Number(a._paramPlus[i] || 0) : 0 })),
          equips: a.equips ? a.equips() : [],
          skills: a.skills ? a.skills() : [],
          states: a.states ? a.states() : []
        };
      }).filter(Boolean);
    },
    gold() { return $gameParty.gold(); },
    inventory() {
      const out = [];
      [
        ["item", dbEntries(window.$dataItems), "Objets"],
        ["weapon", dbEntries(window.$dataWeapons), "Armes"],
        ["armor", dbEntries(window.$dataArmors), "Armures"]
      ].forEach(group => group[1].forEach(data => {
        const obj = objectFor(group[0], data.id);
        if (obj) out.push({ kind: group[0], label: group[2], id: obj.id,
          name: obj.name, count: $gameParty.numItems(obj), object: obj });
      }));
      return out;
    },
    skills() { return dbEntries(window.$dataSkills); },
    states() { return dbEntries(window.$dataStates).filter(s => s.id > 0); }
  };

  const Snapshot = {
    data: null,
    capture() {
      const actors = {};
      Reader.actors().forEach(info => {
        const a = actorFor(info.id);
        actors[info.id] = {
          level: a.level,
          exp: a._exp ? Object.assign({}, a._exp) : null,
          hp: a.hp, mp: a.mp, tp: a.tp,
          paramPlus: a._paramPlus ? a._paramPlus.slice() : [],
          skills: a._skills ? a._skills.slice() : [],
          states: a._states ? a._states.slice() : [],
          stateTurns: a._stateTurns ? Object.assign({}, a._stateTurns) : {},
          equips: a.equips ? a.equips().map(item => item ? {
            kind: DataManager.isWeapon(item) ? "weapon" :
              DataManager.isArmor(item) ? "armor" : "item",
            id: item.id
          } : null) : []
        };
      });
      const inventory = {};
      Reader.inventory().forEach(it => {
        inventory[`${it.kind}:${it.id}`] = { kind: it.kind, id: it.id, count: it.count };
      });
      this.data = { gold: Reader.gold(), actors, inventory, timestamp: Date.now() };
    },
    restore() {
      if (!this.data) return false;
      const snap = this.data;

      // First unequip current gear through the party trade API, so the party
      // inventory can then be reconciled to its captured counts.
      Object.keys(snap.actors).forEach(id => {
        const a = actorFor(id);
        if (!a || !a.equips || !a.changeEquip) return;
        for (let slot = 0; slot < a.equips().length; slot++) {
          if (a.equips()[slot]) a.changeEquip(slot, null);
        }
      });

      $gameParty.gainGold(snap.gold - $gameParty.gold());

      Object.keys(snap.inventory).forEach(key => {
        const saved = snap.inventory[key];
        const obj = objectFor(saved.kind, saved.id);
        if (obj) $gameParty.gainItem(obj,
          saved.count - $gameParty.numItems(obj), cfg.includeEquipped);
      });

      Object.keys(snap.actors).forEach(id => {
        const a = actorFor(id), saved = snap.actors[id];
        if (!a) return;
        if (saved.exp && a.changeExp) {
          const exp = saved.exp[a._classId] != null ? saved.exp[a._classId] : saved.exp[Object.keys(saved.exp)[0]];
          if (exp != null) a.changeExp(exp, false);
        } else if (a.changeLevel) {
          a.changeLevel(saved.level, false);
        }
        if (a._paramPlus) {
          for (let i = 0; i < saved.paramPlus.length; i++) {
            const delta = Number(saved.paramPlus[i] || 0) - Number(a._paramPlus[i] || 0);
            if (delta && a.addParam) a.addParam(i, delta);
          }
        }
        if (a._skills && a.forgetSkill && a.learnSkill) {
          a._skills.slice().forEach(skillId => {
            if (saved.skills.indexOf(skillId) < 0) a.forgetSkill(skillId);
          });
          saved.skills.forEach(skillId => a.learnSkill(skillId));
        }
        if (a._states && a.removeState && a.addState) {
          a._states.slice().forEach(stateId => a.removeState(stateId));
          saved.states.forEach(stateId => a.addState(stateId));
          if (a._stateTurns) a._stateTurns = Object.assign({}, saved.stateTurns);
        }
        if (a.refresh) a.refresh();
        a.setHp(Math.min(saved.hp, a.mhp));
        a.setMp(Math.min(saved.mp, a.mmp));
        if (a.setTp) a.setTp(saved.tp);
      });

      // Re-equip captured gear. changeEquip performs the expected party trade.
      Object.keys(snap.actors).forEach(id => {
        const a = actorFor(id), saved = snap.actors[id];
        if (!a || !a.changeEquip) return;
        saved.equips.forEach((entry, slot) => {
          if (!entry) return;
          const item = objectFor(entry.kind, entry.id);
          if (item) a.changeEquip(slot, item);
        });
      });

      // changeEquip changes inventory counts; reconcile once more to snapshot.
      Object.keys(snap.inventory).forEach(key => {
        const saved = snap.inventory[key], obj = objectFor(saved.kind, saved.id);
        if (obj) $gameParty.gainItem(obj,
          saved.count - $gameParty.numItems(obj), cfg.includeEquipped);
      });
      refreshScene();
      return true;
    },
    diff() {
      if (!this.data) return [];
      const changes = [];
      const add = (label, before, after) => {
        if (String(before) !== String(after)) changes.push({ label, before, after });
      };
      add("Or", this.data.gold, Reader.gold());
      Object.keys(this.data.inventory).forEach(key => {
        const x = this.data.inventory[key], obj = objectFor(x.kind, x.id);
        if (obj) add(`${obj.name} (#${obj.id})`, x.count, $gameParty.numItems(obj));
      });
      Object.keys(this.data.actors).forEach(id => {
        const old = this.data.actors[id], a = actorFor(id);
        if (!a) return;
        const name = a.name ? a.name() : `Acteur ${id}`;
        add(`${name} · Niveau`, old.level, a.level);
        add(`${name} · HP`, old.hp, a.hp);
        add(`${name} · MP`, old.mp, a.mp);
        add(`${name} · TP`, old.tp, a.tp);
        for (let i = 0; i < 8; i++) {
          const before = Number(old.paramPlus[i] || 0);
          const after = Number(a._paramPlus ? a._paramPlus[i] || 0 : 0);
          add(`${name} · ${PARAMS[i]} bonus`, before, after);
        }
        const skills = a._skills || [];
        if (JSON.stringify(old.skills.slice().sort((x,y)=>x-y)) !== JSON.stringify(skills.slice().sort((x,y)=>x-y)))
          changes.push({ label: `${name} · Compétences`, before: old.skills.length, after: skills.length });
        if (JSON.stringify(old.states.slice().sort((x,y)=>x-y)) !== JSON.stringify((a._states || []).slice().sort((x,y)=>x-y)))
          changes.push({ label: `${name} · États`, before: old.states.length, after: (a._states || []).length });
        const nowEquips = a.equips ? a.equips().map(x => x ? `${x.name} (#${x.id})` : "Vide").join(", ") : "";
        const oldEquips = old.equips.map(x => {
          if (!x) return "Vide";
          const obj = objectFor(x.kind, x.id);
          return obj ? `${obj.name} (#${obj.id})` : `#${x.id}`;
        }).join(", ");
        add(`${name} · Équipements`, oldEquips, nowEquips);
      });
      return changes;
    }
  };

  function refreshScene() {
    try {
      const scene = window.SceneManager && SceneManager._scene;
      if (!scene) return;
      ["_statusWindow", "_goldWindow", "_itemWindow", "_equipStatusWindow",
       "_skillStatusWindow", "_actorWindow", "_helpWindow", "_statusListWindow"]
        .forEach(key => {
          const w = scene[key];
          if (w && typeof w.refresh === "function") w.refresh();
        });
      if (scene._spriteset && scene._spriteset.refreshActors) scene._spriteset.refreshActors();
    } catch (e) {
      console.warn("[RPGLiveEditor] Refresh warning:", e);
    }
  }

  const Writer = {
    gold(value) {
      const target = int(value, 0, cfg.maxGold, 0);
      $gameParty.gainGold(target - $gameParty.gold());
      refreshScene();
    },
    item(kind, id, value) {
      const obj = objectFor(kind, id);
      if (!obj) return;
      const target = int(value, 0, cfg.maxItems, 0);
      $gameParty.gainItem(obj, target - $gameParty.numItems(obj), cfg.includeEquipped);
      refreshScene();
    },
    actor(id, field, value) {
      const a = actorFor(id);
      if (!a) return;
      if (field === "level") {
        const max = a.maxLevel ? Math.min(cfg.maxLevel, a.maxLevel()) : cfg.maxLevel;
        a.changeLevel(int(value, 1, max, a.level), false);
      } else if (field === "hp") {
        a.setHp(int(value, 0, a.mhp, a.hp));
      } else if (field === "mp") {
        a.setMp(int(value, 0, a.mmp, a.mp));
      } else if (field === "tp" && a.setTp) {
        a.setTp(int(value, 0, 100, a.tp));
      } else if (field.indexOf("effective:") === 0) {
        const pid = int(field.split(":")[1], 0, 7, 0);
        const target = int(value, 0, cfg.maxParam, a.param(pid));
        if (a.addParam) a.addParam(pid, target - a.param(pid));
      } else if (field.indexOf("bonus:") === 0) {
        const pid = int(field.split(":")[1], 0, 7, 0);
        const target = int(value, -999999, 999999, 0);
        const current = a._paramPlus ? Number(a._paramPlus[pid] || 0) : 0;
        if (a.addParam) a.addParam(pid, target - current);
      }
      if (a.refresh) a.refresh();
      refreshScene();
    },
    equip(actorId, slotId, kind, itemId) {
      const a = actorFor(actorId);
      if (!a || !a.changeEquip) return;
      const item = kind === "none" ? null : objectFor(kind, itemId);
      a.changeEquip(Number(slotId), item);
      if (a.refresh) a.refresh();
      refreshScene();
    },
    skill(actorId, skillId, learn) {
      const a = actorFor(actorId);
      if (!a) return;
      if (learn && a.learnSkill) a.learnSkill(Number(skillId));
      if (!learn && a.forgetSkill) a.forgetSkill(Number(skillId));
      refreshScene();
    },
    state(actorId, stateId, add) {
      const a = actorFor(actorId);
      if (!a) return;
      if (add && a.addState) a.addState(Number(stateId));
      if (!add && a.removeState) a.removeState(Number(stateId));
      refreshScene();
    }
  };

  const UI = {
    root: null, opened: false, tab: "actors", search: "", selectedActor: 0,
    ensure() {
      if (this.root) return;
      const style = document.createElement("style");
      style.id = "rpgm-live-editor-style";
      style.textContent = `
      #rpgm-live-editor{position:fixed;z-index:2147483646;top:3vh;left:50%;transform:translateX(-50%);
       width:min(1040px,96vw);max-height:94vh;background:#171923;color:#f4f4f5;border:1px solid #52566a;
       border-radius:12px;box-shadow:0 18px 70px #000b;font:14px/1.4 Arial,sans-serif;display:none;overflow:hidden}
      #rpgm-live-editor *{box-sizing:border-box}#rpgm-live-editor .rle-head{display:flex;align-items:center;
       justify-content:space-between;padding:12px 16px;background:#232638;border-bottom:1px solid #41465a}
      #rpgm-live-editor .rle-title{font-size:16px;font-weight:bold}#rpgm-live-editor button,#rpgm-live-editor input,
      #rpgm-live-editor select{font:inherit;border-radius:6px;border:1px solid #555b70;padding:7px 9px}
      #rpgm-live-editor button{background:#343a50;color:#fff;cursor:pointer}#rpgm-live-editor button:hover{background:#46506c}
      #rpgm-live-editor button.active{background:#315c9b}#rpgm-live-editor .rle-close{background:#7f2938}
      #rpgm-live-editor .rle-tabs{display:flex;gap:6px;padding:10px 14px;border-bottom:1px solid #41465a;flex-wrap:wrap}
      #rpgm-live-editor .rle-body{padding:14px;overflow:auto;max-height:69vh}
      #rpgm-live-editor .rle-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(245px,1fr));gap:10px}
      #rpgm-live-editor .rle-card{background:#222637;border:1px solid #41465a;border-radius:8px;padding:12px;min-width:0}
      #rpgm-live-editor .rle-card h3{margin:0 0 9px;font-size:15px}#rpgm-live-editor label{display:flex;align-items:center;
       justify-content:space-between;gap:10px;margin:6px 0;color:#d4d7e2}
      #rpgm-live-editor input[type=number]{width:112px;background:#111522;color:#fff}
      #rpgm-live-editor input[type=search],#rpgm-live-editor select{background:#111522;color:#fff}
      #rpgm-live-editor select{max-width:65%;min-width:120px}#rpgm-live-editor .rle-wide{width:100%;margin-bottom:10px}
      #rpgm-live-editor .rle-muted{color:#a7adbf;font-size:12px}#rpgm-live-editor .rle-foot{display:flex;gap:8px;
       justify-content:space-between;align-items:center;padding:11px 14px;background:#232638;border-top:1px solid #41465a;flex-wrap:wrap}
      #rpgm-live-editor .rle-danger{background:#79313c}#rpgm-live-editor .rle-empty{padding:25px;text-align:center;color:#b9bfd0}
      #rpgm-live-editor .rle-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:7px 0}
      #rpgm-live-editor .rle-row>*{min-width:0}#rpgm-live-editor .rle-scroll{max-height:250px;overflow:auto}
      #rpgm-live-editor .rle-change{border-bottom:1px solid #3e4355;padding:7px 0}
      @media(max-width:600px){#rpgm-live-editor{top:1vh;max-height:98vh}#rpgm-live-editor .rle-body{max-height:76vh}}
      `;
      document.head.appendChild(style);
      this.root = document.createElement("div");
      this.root.id = "rpgm-live-editor";
      // Keep native form controls usable while preventing events from reaching
      // the game's document-level input/touch handlers.
      ["mousedown","mouseup","mousemove","click","dblclick","pointerdown","pointerup",
       "pointermove","touchstart","touchend","touchmove","contextmenu","wheel"].forEach(type => {
        this.root.addEventListener(type, e => e.stopPropagation());
      });
      ["keydown","keyup","keypress"].forEach(type => {
        this.root.addEventListener(type, e => {
          if (textField(e.target)) e.stopPropagation();
        });
      });
      this.root.addEventListener("input", e => e.stopPropagation());
      document.body.appendChild(this.root);
      this.render();
    },
    open() {
      if (!activeGame()) return;
      this.ensure();
      if (!Snapshot.data) Snapshot.capture();
      this.opened = true;
      this.root.style.display = "block";
      this.render();
    },
    close() {
      if (this.root) this.root.style.display = "none";
      this.opened = false;
    },
    toggle() { this.opened ? this.close() : this.open(); },
    field(label, value, write, min, max) {
      return `<label><span>${esc(label)}</span><input type="number" step="1" min="${min}" max="${max}" value="${int(value,-2147483647,2147483647,0)}" data-write="${esc(write)}"></label>`;
    },
    actorSelector() {
      const actors = Reader.actors();
      if (!actors.length) return "";
      if (!actors.some(a => a.id === this.selectedActor)) this.selectedActor = actors[0].id;
      return `<div class="rle-row"><span>Personnage</span><select id="rle-actor-select">${actors.map(a =>
        `<option value="${a.id}" ${a.id===this.selectedActor?"selected":""}>${esc(a.name)} (#${a.id})</option>`).join("")}</select></div>`;
    },
    renderActors() {
      const actors = Reader.actors();
      if (!actors.length) return '<div class="rle-empty">Aucun personnage actif.</div>';
      return `<div class="rle-grid">${actors.map(a => `<section class="rle-card">
        <h3>${esc(a.name)} <span class="rle-muted">#${a.id} · ${esc(a.className)}</span></h3>
        ${this.field("Niveau",a.level,`actor|${a.id}|level`,1,cfg.maxLevel)}
        ${this.field(`HP (max ${a.mhp})`,a.hp,`actor|${a.id}|hp`,0,a.mhp)}
        ${this.field(`MP (max ${a.mmp})`,a.mp,`actor|${a.id}|mp`,0,a.mmp)}
        ${this.field("TP",a.tp,`actor|${a.id}|tp`,0,100)}
        <div class="rle-muted">Paramètres effectifs (calculés par le moteur)</div>
        ${a.params.map(p=>this.field(p.label,p.value,`actor|${a.id}|effective:${p.id}`,0,cfg.maxParam)).join("")}
        <details><summary>Bonus internes (_paramPlus)</summary>
          ${a.params.map(p=>this.field(p.label+" bonus",p.plus,`actor|${a.id}|bonus:${p.id}`,-999999,999999)).join("")}
        </details></section>`).join("")}</div>`;
    },
    renderGold() {
      return `<section class="rle-card"><h3>Argent de l'équipe</h3><div class="rle-muted">Total actuel : ${Reader.gold()}</div>
        ${this.field("Or cible",Reader.gold(),"gold",0,cfg.maxGold)}</section>`;
    },
    renderInventory() {
      const q = this.search.toLowerCase();
      const items = Reader.inventory().filter(x => x.name.toLowerCase().includes(q) || String(x.id).includes(q));
      return `<input id="rle-search" class="rle-wide" type="search" placeholder="Rechercher par nom ou ID…" value="${esc(this.search)}">
        <div class="rle-grid">${items.map(x=>`<section class="rle-card"><h3>${esc(x.name)} <span class="rle-muted">#${x.id} · ${x.label}</span></h3>
        ${this.field("Quantité",x.count,`item|${x.kind}|${x.id}`,0,cfg.maxItems)}</section>`).join("")}</div>
        ${items.length?"":'<div class="rle-empty">Aucun résultat.</div>'}`;
    },
    renderEquipment() {
      const actors = Reader.actors();
      if (!actors.length) return '<div class="rle-empty">Aucun personnage.</div>';
      const a = actorFor(this.selectedActor);
      if (!a || !a.equips) return '<div class="rle-empty">Équipement indisponible.</div>';
      const slots = a.equipSlots ? a.equipSlots() : [];
      const all = Reader.inventory();
      return `${this.actorSelector()}<section class="rle-card"><h3>Équipements portés</h3>
        ${slots.map((etype,slot)=>{
          const current = a.equips()[slot];
          const candidates = all.filter(x => {
            const obj = x.object;
            return x.kind==="weapon" ? Number(obj.wtypeId)===Number(etype) :
              x.kind==="armor" && Number(obj.atypeId)===Number(etype);
          });
          if (current && !candidates.some(x => x.kind==="weapon" && DataManager.isWeapon(current) && x.id===current.id ||
              x.kind==="armor" && DataManager.isArmor(current) && x.id===current.id)) {
            candidates.unshift({kind:DataManager.isWeapon(current)?"weapon":"armor",id:current.id,
              name:current.name,count:0,object:current});
          }
          const options = [`<option value="none" ${current?"":"selected"}>— Aucun —</option>`].concat(candidates.map(x=>
            `<option value="${x.kind}:${x.id}" ${current && current.id===x.id && ((x.kind==="weapon")===DataManager.isWeapon(current))?"selected":""}>${esc(x.name)}${x.count ? ` (x${x.count})` : " (équipé)"}</option>`));
          return `<label><span>${esc((window.$dataSystem && $dataSystem.equipTypes && $dataSystem.equipTypes[etype]) || "Emplacement "+(slot+1))}</span>
            <select data-equip="${a.actorId()}|${slot}">${options.join("")}</select></label>`;
        }).join("")}
        <div class="rle-muted">Les changements utilisent changeEquip : les règles d'équipement du jeu restent appliquées.</div></section>`;
    },
    renderSkillsStates() {
      const actors = Reader.actors(), a = actorFor(this.selectedActor);
      if (!actors.length || !a) return '<div class="rle-empty">Aucun personnage.</div>';
      const skills = Reader.skills(), states = Reader.states();
      const learned = a._skills || [], activeStates = a._states || [];
      return `${this.actorSelector()}<div class="rle-grid">
        <section class="rle-card"><h3>Compétences</h3><input class="rle-wide" id="rle-skill-search" type="search" placeholder="Filtrer les compétences…">
          <div class="rle-scroll" id="rle-skills">${skills.map(s=>`<label><span>${esc(s.name)} <span class="rle-muted">#${s.id}</span></span>
          <input type="checkbox" data-skill="${a.actorId()}|${s.id}" ${learned.includes(s.id)?"checked":""}></label>`).join("")}</div></section>
        <section class="rle-card"><h3>États actifs</h3><div class="rle-scroll">${states.map(s=>`<label><span>${esc(s.name)} <span class="rle-muted">#${s.id}</span></span>
          <input type="checkbox" data-state="${a.actorId()}|${s.id}" ${activeStates.includes(s.id)?"checked":""}></label>`).join("")}</div>
          <div class="rle-muted">Ajouter ou retirer un état via les API du moteur.</div></section>
      </div>`;
    },
    renderSnapshot() {
      if (!Snapshot.data) return '<div class="rle-empty">Aucun snapshot. Il sera créé à la première ouverture.</div>';
      const changes = Snapshot.diff();
      return `<section class="rle-card"><h3>Snapshot de session</h3>
        <div class="rle-muted">Capture initiale : ${new Date(Snapshot.data.timestamp).toLocaleString()}</div>
        <div class="rle-row"><strong>${changes.length}</strong><span>différence(s) détectée(s)</span></div>
        <div class="rle-scroll">${changes.length ? changes.map(c=>`<div class="rle-change"><strong>${esc(c.label)}</strong><br>
          <span class="rle-muted">${esc(c.before)} → ${esc(c.after)}</span></div>`).join("") :
          '<div class="rle-muted">Aucune différence par rapport au snapshot.</div>'}</div>
        <div class="rle-row"><button data-action="capture">Créer un nouveau snapshot</button>
        <button class="rle-danger" data-action="restore">Restaurer le snapshot</button></div>
        <div class="rle-muted">La restauration concerne l'or, l'inventaire, les personnages, équipements, compétences et états connus lors de la capture. Elle reste en mémoire.</div>
      </section>`;
    },
    render() {
      if (!this.root) return;
      const tabs = [["actors","Personnages"],["gold","Argent"],["inventory","Inventaire"],
        ["equipment","Équipements"],["skills","Compétences / États"],["snapshot","Snapshot"]];
      let body = this.tab==="actors" ? this.renderActors() :
        this.tab==="gold" ? this.renderGold() :
        this.tab==="inventory" ? this.renderInventory() :
        this.tab==="equipment" ? this.renderEquipment() :
        this.tab==="skills" ? this.renderSkillsStates() : this.renderSnapshot();
      this.root.innerHTML = `<div class="rle-head"><div><div class="rle-title">RPG Maker Live Editor <span class="rle-muted">v1.1.0 · ${esc(engineName())}</span></div>
        <div class="rle-muted">Édition en mémoire · F6 pour masquer</div></div><button class="rle-close" data-action="close">Fermer ✕</button></div>
        <div class="rle-tabs">${tabs.map(t=>`<button data-tab="${t[0]}" class="${this.tab===t[0]?"active":""}">${t[1]}</button>`).join("")}</div>
        <div class="rle-body">${body}</div>
        <div class="rle-foot"><span class="rle-muted">Snapshot ${Snapshot.data?"capturé":"absent"} · ${esc(engineName())}</span>
        <div><button data-action="refresh">Rafraîchir</button><button class="rle-danger" data-action="restore">Annuler les modifications</button></div></div>`;
      this.bind();
    },
    bind() {
      this.root.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>{
        this.tab=b.dataset.tab; this.render();
      }));
      this.root.querySelectorAll("[data-action]").forEach(b=>b.addEventListener("click",()=>{
        const action=b.dataset.action;
        if(action==="close") this.close();
        if(action==="refresh") this.render();
        if(action==="capture" && confirm("Remplacer le snapshot actuel par l'état actuel du jeu ?")) {
          Snapshot.capture(); this.render();
        }
        if(action==="restore" && confirm("Restaurer l'état capturé dans le snapshot ?")) {
          Snapshot.restore(); this.render();
        }
      }));
      this.root.querySelectorAll("[data-write]").forEach(input=>input.addEventListener("change",()=>{
        const p=input.dataset.write.split("|"), v=Number(input.value);
        if(p[0]==="gold") Writer.gold(v);
        else if(p[0]==="item") Writer.item(p[1],p[2],v);
        else if(p[0]==="actor") Writer.actor(p[1],p[2],v);
        this.render();
      }));
      const actorSelect=this.root.querySelector("#rle-actor-select");
      if(actorSelect) actorSelect.addEventListener("change",()=>{
        this.selectedActor=Number(actorSelect.value); this.render();
      });
      this.root.querySelectorAll("[data-equip]").forEach(select=>select.addEventListener("change",()=>{
        const [actorId,slot]=select.dataset.equip.split("|");
        const value=select.value.split(":");
        Writer.equip(actorId,slot,value[0],value[1]); this.render();
      }));
      this.root.querySelectorAll("[data-skill]").forEach(check=>check.addEventListener("change",()=>{
        const [actorId,skillId]=check.dataset.skill.split("|");
        Writer.skill(actorId,skillId,check.checked);
      }));
      this.root.querySelectorAll("[data-state]").forEach(check=>check.addEventListener("change",()=>{
        const [actorId,stateId]=check.dataset.state.split("|");
        Writer.state(actorId,stateId,check.checked);
      }));
      const search=this.root.querySelector("#rle-search");
      if(search) search.addEventListener("input",()=>{
        const pos=search.selectionStart; this.search=search.value;
        const body=this.root.querySelector(".rle-body");
        body.innerHTML=this.renderInventory();
        const next=this.root.querySelector("#rle-search");
        if(next){next.focus();next.setSelectionRange(pos,pos);}
        this.root.querySelectorAll("[data-write]").forEach(input=>input.addEventListener("change",()=>{
          const p=input.dataset.write.split("|"); Writer.item(p[1],p[2],Number(input.value)); this.render();
        }));
      });
      const skillSearch=this.root.querySelector("#rle-skill-search");
      if(skillSearch) skillSearch.addEventListener("input",()=>{
        const q=skillSearch.value.toLowerCase();
        this.root.querySelectorAll("#rle-skills label").forEach(row=>{
          row.style.display=row.textContent.toLowerCase().includes(q)?"flex":"none";
        });
      });
    }
  };

  function detectConflicts() {
    const plugins = Array.isArray(window.$plugins) ? $plugins.filter(p=>p && p.status) : [];
    const suspects = plugins.filter(p => p.name && p.name !== PLUGIN_NAME &&
      /input|key|touch|overlay|cheat|debug/i.test(p.name));
    if (suspects.length) console.warn("[RPGLiveEditor] Plugins susceptibles d'intercepter les entrées :", suspects.map(p=>p.name));
    if (window.Input && Input.keyMapper && Input.keyMapper[117]) {
      console.info("[RPGLiveEditor] F6 peut être remappée par Input.keyMapper[117]. Le gestionnaire DOM intercepte F6 en priorité.");
    }
  }

  // Capture-phase interception so F6 does not reach the engine's Input handler.
  document.addEventListener("keydown", event => {
    const key=String(event.key||"").toUpperCase();
    const toggle=key===cfg.toggleKey || (cfg.toggleKey==="F6" && event.keyCode===117);
    if(toggle) {
      event.preventDefault(); event.stopPropagation();
      if(event.stopImmediatePropagation) event.stopImmediatePropagation();
      if(activeGame()) UI.toggle();
      return;
    }
    if(UI.opened && key==="ESCAPE" && !textField(document.activeElement)) {
      event.preventDefault(); event.stopPropagation();
      if(event.stopImmediatePropagation) event.stopImmediatePropagation();
      UI.close();
    }
  }, true);

  ["keyup","keypress"].forEach(type=>document.addEventListener(type,event=>{
    if(UI.opened && (textField(event.target) || String(event.key||"").toUpperCase()==="F6")) {
      event.stopPropagation();
      if(event.stopImmediatePropagation) event.stopImmediatePropagation();
    }
  },true));

  window.RPGLiveEditor = {
    version:"1.1.0",
    open:()=>UI.open(),
    close:()=>UI.close(),
    refresh:()=>UI.refresh(),
    captureSnapshot:()=>{if(activeGame())Snapshot.capture();},
    restoreSnapshot:()=>Snapshot.restore(),
    getSnapshotDiff:()=>Snapshot.diff(),
    getEngine:engineName
  };
  detectConflicts();
  console.info("[RPGLiveEditor] v1.1.0 loaded. Press F6 during an active game.");
})();
