
import React, { useState } from 'react';
import { OriginData, CustomPower, CustomFunction } from '../types';
import { Plus, X, Wand2, Code, Terminal, Play, Clock, Save, FileCode, Edit2, Trash2, Eye, Sparkles, AlertTriangle } from 'lucide-react';

interface OriginEditorProps {
  data: OriginData;
  onChange: (data: OriginData) => void;
  onGenerate: (prompt: string) => Promise<void>;
  isGenerating: boolean;
}

type EditorTab = 'general' | 'powers' | 'functions';

const POWER_TEMPLATES = [
  {
    label: "Habilidad Activa (Función)",
    type: "origins:active_self",
    description: "Tecla -> Ejecuta una función (.mcfunction)",
    json: {
      "name": "Nombre Habilidad",
      "description": "Descripción...",
      "type": "origins:active_self",
      "cooldown": 100,
      "hud_render": {
        "should_render": true,
        "bar_index": 2
      },
      "key": {
        "key": "key.origins.primary_active"
      },
      "entity_action": {
        "type": "origins:execute_command",
        "command": "function namespace:abilities/my_ability"
      }
    }
  },
  {
    label: "Pasiva (Atributo)",
    type: "origins:attribute",
    description: "Modifica vida, velocidad, daño, etc.",
    json: {
      "type": "origins:attribute",
      "modifier": {
        "attribute": "minecraft:generic.max_health",
        "operation": "addition",
        "value": 10.0,
        "name": "More Health"
      }
    }
  },
  {
    label: "Callback (Init/Cleanup)",
    type: "origins:action_on_callback",
    description: "Ejecuta funciones al elegir o perder el origen.",
    json: {
      "type": "origins:action_on_callback",
      "entity_action_chosen": {
        "type": "origins:execute_command",
        "command": "function namespace:utils/init"
      },
      "entity_action_lost": {
        "type": "origins:execute_command",
        "command": "function namespace:utils/cleanup"
      }
    }
  }
];

export const OriginEditor: React.FC<OriginEditorProps> = ({ data, onChange, onGenerate, isGenerating }) => {
  const [prompt, setPrompt] = useState('');
  const [activeTab, setActiveTab] = useState<EditorTab>('general');
  const [newPowerId, setNewPowerId] = useState('');
  
  // Custom Power Editor State
  const [editingPower, setEditingPower] = useState<CustomPower | null>(null);
  const [tempJson, setTempJson] = useState('');

  // Custom Function Editor State
  const [editingFunction, setEditingFunction] = useState<CustomFunction | null>(null);
  const [tempFunctionContent, setTempFunctionContent] = useState('');
  const [tempFunctionPath, setTempFunctionPath] = useState('');
  const [tempFunctionTag, setTempFunctionTag] = useState<'none' | 'load' | 'tick'>('none');

  const handleChange = (field: keyof OriginData, value: any) => {
    onChange({ ...data, [field]: value });
  };

  const handleNamespaceChange = (value: string) => {
    // Sanitize: lowercase, numbers, underscores only
    const sanitized = value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    handleChange('namespace', sanitized);
  };

  const addStandardPower = () => {
    if (newPowerId.trim()) {
      handleChange('powers', [...data.powers, newPowerId.trim()]);
      setNewPowerId('');
    }
  };

  const removePowerId = (id: string) => {
    handleChange('powers', data.powers.filter(p => p !== id));
    handleChange('customPowers', data.customPowers.filter(p => p.id !== id));
  };

  const startEditingPower = (power?: CustomPower) => {
    if (power) {
      setEditingPower(power);
      setTempJson(power.json);
    } else {
      const ns = data.namespace || 'mypack';
      const newId = `${ns}:new_power_${data.customPowers.length + 1}`;
      const template = POWER_TEMPLATES[0]; 
      const defaultJson = JSON.stringify(template.json, null, 2).replace('namespace', ns);
      
      setEditingPower({
        id: newId,
        name: "Nuevo Poder",
        type: template.type,
        json: defaultJson
      });
      setTempJson(defaultJson);
    }
  };

  const startEditingFunction = (func?: CustomFunction) => {
    if (func) {
      setEditingFunction(func);
      setTempFunctionPath(func.path);
      setTempFunctionContent(func.content);
      setTempFunctionTag(func.tag);
    } else {
      setEditingFunction({ path: "", content: "", tag: 'none' });
      setTempFunctionPath(`abilities/logic_${data.functions.length + 1}`);
      setTempFunctionContent("# Comandos lógicos aquí\n# schedule function namespace:path 1s\nparticle minecraft:flame ~ ~ ~ 0.5 0.5 0.5 0.1 10");
      setTempFunctionTag('none');
    }
  };

  const applyTemplate = (template: typeof POWER_TEMPLATES[0]) => {
      if (!editingPower) return;
      const jsonStr = JSON.stringify(template.json, null, 2).replace('namespace', data.namespace);
      setTempJson(jsonStr);
      setEditingPower({
          ...editingPower,
          type: template.type,
          json: jsonStr
      });
  };

  const saveCustomPower = () => {
    if (!editingPower) return;
    try {
      const parsed = JSON.parse(tempJson);
      const formattedJson = JSON.stringify(parsed, null, 2);
      const updatedPower = { ...editingPower, json: formattedJson };
      let newCustomPowers = [...data.customPowers];
      const existingIndex = newCustomPowers.findIndex(p => p.id === editingPower.id);
      if (existingIndex >= 0) {
        newCustomPowers[existingIndex] = updatedPower;
      } else {
        newCustomPowers.push(updatedPower);
        if (!data.powers.includes(updatedPower.id)) {
           handleChange('powers', [...data.powers, updatedPower.id]);
        }
      }
      handleChange('customPowers', newCustomPowers);
      setEditingPower(null);
    } catch (e) {
      alert("JSON inválido. Por favor revisa la sintaxis.");
    }
  };

  const saveCustomFunction = () => {
      if (!editingFunction) return;
      const cleanPath = tempFunctionPath.trim().replace(/\.mcfunction$/, '');
      if (!cleanPath) return alert("El path no puede estar vacío");

      const updatedFunc: CustomFunction = { 
          path: cleanPath, 
          content: tempFunctionContent,
          tag: tempFunctionTag
      };
      
      let newFunctions = [...data.functions];
      if (editingFunction.path) {
          newFunctions = newFunctions.filter(f => f.path !== editingFunction.path);
      }
      newFunctions = newFunctions.filter(f => f.path !== cleanPath);
      newFunctions.push(updatedFunc);
      handleChange('functions', newFunctions);
      setEditingFunction(null);
  };

  const removeFunction = (path: string) => {
      handleChange('functions', data.functions.filter(f => f.path !== path));
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    await onGenerate(prompt);
  };

  // --- VALIDATION LOGIC ---
  const validateFunctionLinks = (powerJson: string): string[] => {
      const missingFunctions: string[] = [];
      try {
          const ns = data.namespace;
          const regex = new RegExp(`function\\s+${ns}:([a-zA-Z0-9_\\/]+)`, 'g');
          let match;
          while ((match = regex.exec(powerJson)) !== null) {
              const funcPath = match[1];
              const exists = data.functions.some(f => f.path === funcPath);
              if (!exists) {
                  missingFunctions.push(funcPath);
              }
          }
      } catch (e) {
      }
      return missingFunctions;
  };

  // UI Component Helpers
  const InputClass = "w-full bg-[#050505] border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-400 focus:shadow-[0_0_10px_rgba(0,242,255,0.2)] transition-all font-mono text-sm";
  const LabelClass = "text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 block";

  return (
    <div className="space-y-6 pb-20">
      {/* AI Generator Section */}
      <div className="glass-panel p-6 rounded-2xl shadow-xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>
        
        <div className="relative z-10">
          <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-lg">
                <Sparkles className="w-5 h-5 text-white" />
            </div>
            AI Origins Architect
          </h2>
          <p className="text-gray-400 text-sm mb-6 max-w-2xl">
            Describe tu Origin. La IA generará tanto los JSONs de poderes como los archivos .mcfunction para la lógica compleja (partículas, combos, etc).
          </p>
          <form onSubmit={handleGenerate} className="flex gap-3">
            <div className="relative flex-1">
                <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Ej: Un 'Demolisher' que crea explosiones en cadena cuando presiono G..."
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-5 py-4 text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none placeholder-gray-600 transition-all backdrop-blur-sm"
                />
            </div>
            <button
                type="submit"
                disabled={isGenerating || !prompt.trim()}
                className="bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-2 rounded-xl font-bold transition-all shadow-lg shadow-purple-900/30 flex items-center gap-2 whitespace-nowrap hover:shadow-cyan-500/20 hover:scale-[1.02]"
            >
                {isGenerating ? <Wand2 className="w-5 h-5 animate-spin"/> : <Wand2 className="w-5 h-5"/>}
                {isGenerating ? 'Generar Origin' : 'Generar'}
            </button>
          </form>
        </div>
      </div>

      {/* Editor Tabs */}
      <div className="flex border-b border-white/10 space-x-6 overflow-x-auto">
        {(['general', 'powers', 'functions'] as EditorTab[]).map((tab) => (
             <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 px-1 text-sm font-medium transition-all border-b-2 whitespace-nowrap ${
                    activeTab === tab 
                    ? 'border-cyan-400 text-cyan-400' 
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
            >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">

        {activeTab === 'general' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
            <div className="space-y-1">
              <label className={LabelClass}>Nombre del Origin</label>
              <input type="text" value={data.name} onChange={(e) => handleChange('name', e.target.value)} className={InputClass} />
            </div>
            <div className="space-y-1">
              <label className={LabelClass}>Namespace (ID Carpeta)</label>
              <div className="relative">
                  <input 
                    type="text" 
                    value={data.namespace} 
                    onChange={(e) => handleNamespaceChange(e.target.value)} 
                    placeholder="ej: my_origin"
                    className={`${InputClass} text-cyan-400 font-bold`} 
                  />
                  <div className="absolute right-3 top-2.5 text-xs text-gray-500 pointer-events-none">data/{data.namespace}/...</div>
              </div>
            </div>
            <div className="space-y-1">
              <label className={LabelClass}>Ícono (Item ID)</label>
              <input type="text" value={data.icon} onChange={(e) => handleChange('icon', e.target.value)} className={InputClass} />
            </div>
             <div className="space-y-1">
              <label className={LabelClass}>Pack Format</label>
              <input type="number" value={data.packFormat} onChange={(e) => handleChange('packFormat', parseInt(e.target.value) || 15)} className={InputClass} />
              <p className="text-[10px] text-gray-500 mt-1">
                15 = 1.20.1 | 18 = 1.20.2 | 26 = 1.20.4 | 48 = 1.21
              </p>
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className={LabelClass}>Descripción</label>
              <textarea value={data.description} onChange={(e) => handleChange('description', e.target.value)} rows={3} className={`${InputClass} resize-none`} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className={LabelClass}>Impacto</label>
              <div className="flex gap-4">
                {[0, 1, 2, 3].map((level) => (
                  <button
                    key={level}
                    onClick={() => handleChange('impact', level)}
                    className={`flex-1 py-2 rounded-lg font-medium transition-all border ${
                      data.impact === level
                        ? 'bg-cyan-600/20 border-cyan-500 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                        : 'bg-white/5 border-white/5 text-gray-500 hover:bg-white/10'
                    }`}
                  >
                    {['Ninguno', 'Bajo', 'Medio', 'Alto'][level]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'powers' && (
          <div className="space-y-6 animate-fadeIn">
            {editingPower ? (
                <div className="glass-panel p-6 rounded-xl space-y-4">
                    <div className="flex justify-between items-center border-b border-white/10 pb-4">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <Code className="w-5 h-5 text-cyan-400"/>
                            Editando: <span className="text-gray-400">{editingPower.id}</span>
                        </h3>
                        <button onClick={() => setEditingPower(null)} className="text-gray-400 hover:text-white transition-colors">
                            <X className="w-5 h-5"/>
                        </button>
                    </div>

                    <div className="flex gap-2 pb-2 overflow-x-auto">
                        {POWER_TEMPLATES.map((tmpl, idx) => (
                            <button
                                key={idx}
                                onClick={() => applyTemplate(tmpl)}
                                className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 whitespace-nowrap"
                            >
                                <FileCode className="w-3 h-3 text-cyan-500" />
                                {tmpl.label}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={LabelClass}>ID (Namespace:name)</label>
                            <input value={editingPower.id} onChange={(e) => setEditingPower({...editingPower, id: e.target.value})} className={InputClass} />
                        </div>
                        <div>
                             <label className={LabelClass}>Tipo</label>
                             <input value={editingPower.type} onChange={(e) => setEditingPower({...editingPower, type: e.target.value})} className={InputClass} />
                        </div>
                    </div>
                    <div className="h-96 relative">
                        <textarea
                            value={tempJson}
                            onChange={(e) => setTempJson(e.target.value)}
                            className="w-full h-full bg-[#050505] border border-white/10 rounded-lg p-4 font-mono text-sm text-gray-300 focus:outline-none focus:border-cyan-500/50 resize-none custom-scrollbar"
                            spellCheck={false}
                        />
                    </div>
                    {/* Validation Warning in Editor */}
                    {(() => {
                        const missing = validateFunctionLinks(tempJson);
                        if (missing.length > 0) {
                            return (
                                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-start gap-3">
                                    <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm text-yellow-200 font-bold">Funciones faltantes detectadas:</p>
                                        <ul className="list-disc list-inside text-xs text-yellow-200/80 mt-1">
                                            {missing.map(m => (
                                                <li key={m}>
                                                    Se llama a <span className="font-mono bg-black/30 px-1 rounded">{m}</span> pero no existe en Functions.
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            );
                        }
                        return null;
                    })()}

                    <div className="flex justify-end gap-2">
                        <button onClick={() => setEditingPower(null)} className="px-4 py-2 rounded-lg text-gray-400 hover:bg-white/5 transition-colors">Cancelar</button>
                        <button onClick={saveCustomPower} className="px-6 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium flex items-center gap-2 transition-colors shadow-lg shadow-cyan-900/20">
                            <Save className="w-4 h-4" /> Guardar JSON
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="flex items-center justify-between">
                        <h3 className={LabelClass}>Poderes Personalizados (JSON)</h3>
                        <button onClick={() => startEditingPower()} className="text-xs bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 border border-cyan-500/30 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all">
                            <Plus className="w-3 h-3"/> Nuevo Poder
                        </button>
                    </div>
                    <div className="grid gap-2">
                        {data.customPowers.map((cp, idx) => {
                            const missingFunctions = validateFunctionLinks(cp.json);
                            return (
                                <div key={idx} className="glass-panel p-3 rounded-lg flex items-center justify-between group hover:border-cyan-500/30 transition-all relative overflow-hidden">
                                    <div className="flex items-center gap-3 relative z-10">
                                        <div className="bg-cyan-500/10 p-2 rounded-lg border border-cyan-500/20">
                                            <Code className="w-4 h-4 text-cyan-400" />
                                        </div>
                                        <div>
                                            <div className="font-mono text-sm text-cyan-100 flex items-center gap-2">
                                                {cp.id}
                                                {missingFunctions.length > 0 && (
                                                    <div className="group/tooltip relative">
                                                        <AlertTriangle className="w-4 h-4 text-yellow-500 animate-pulse" />
                                                        <div className="absolute left-6 top-1/2 -translate-y-1/2 w-48 bg-black/90 border border-yellow-500/50 rounded p-2 text-[10px] text-yellow-200 opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity z-50">
                                                            Falta lógica: {missingFunctions[0]}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-xs text-gray-500">{cp.type}</div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity relative z-10">
                                        <button onClick={() => startEditingPower(cp)} className="p-1.5 hover:bg-white/10 rounded text-gray-300">
                                            <Edit2 className="w-4 h-4"/>
                                        </button>
                                        <button onClick={() => removePowerId(cp.id)} className="p-1.5 hover:bg-red-500/20 rounded text-red-400">
                                            <Trash2 className="w-4 h-4"/>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                         {data.customPowers.length === 0 && (
                            <div className="text-center py-8 border border-dashed border-white/10 rounded-lg">
                                <p className="text-gray-600 text-sm">No hay poderes definidos.</p>
                            </div>
                        )}
                    </div>
                </>
            )}
          </div>
        )}

        {activeTab === 'functions' && (
             <div className="space-y-6 animate-fadeIn">
                 {editingFunction ? (
                     <div className="glass-panel p-6 rounded-xl space-y-4">
                        <div className="flex justify-between items-center border-b border-white/10 pb-4">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Terminal className="w-5 h-5 text-purple-400"/>
                                Editando Función (.mcfunction)
                            </h3>
                            <button onClick={() => setEditingFunction(null)} className="text-gray-400 hover:text-white">
                                <X className="w-5 h-5"/>
                            </button>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-2">
                                <label className={LabelClass}>Path (relativo)</label>
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-500 text-sm font-mono">{data.namespace}/functions/</span>
                                    <input 
                                        value={tempFunctionPath}
                                        onChange={(e) => setTempFunctionPath(e.target.value)}
                                        placeholder="abilities/fireball_logic"
                                        className={`${InputClass} text-purple-400`}
                                    />
                                </div>
                            </div>
                             <div>
                                <label className={LabelClass}>Ejecución (Tag)</label>
                                <select
                                    value={tempFunctionTag}
                                    onChange={(e) => setTempFunctionTag(e.target.value as any)}
                                    className={`${InputClass} appearance-none cursor-pointer`}
                                >
                                    <option value="none">Manual (None)</option>
                                    <option value="load">Al Cargar (Load)</option>
                                    <option value="tick">Cada Tick (Tick)</option>
                                </select>
                            </div>
                        </div>
                        <div className="h-96 relative">
                            <textarea
                                value={tempFunctionContent}
                                onChange={(e) => setTempFunctionContent(e.target.value)}
                                className="w-full h-full bg-[#050505] border border-white/10 rounded-lg p-4 font-mono text-sm text-gray-300 focus:outline-none focus:border-purple-500/50 resize-none custom-scrollbar"
                                spellCheck={false}
                                placeholder="# Comandos de Minecraft Function"
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setEditingFunction(null)} className="px-4 py-2 rounded-lg text-gray-400 hover:bg-white/5 transition-colors">Cancelar</button>
                            <button onClick={saveCustomFunction} className="px-6 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium flex items-center gap-2 transition-colors shadow-lg shadow-purple-900/20">
                                <Save className="w-4 h-4" /> Guardar .mcfunction
                            </button>
                        </div>
                     </div>
                 ) : (
                     <>
                        <div className="flex items-center justify-between">
                            <h3 className={LabelClass}>Archivos de Lógica (.mcfunction)</h3>
                            <button onClick={() => startEditingFunction()} className="text-xs bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-500/30 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all">
                                <Plus className="w-3 h-3"/> Nueva Función
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mb-4">
                            Aquí es donde ocurre la magia. Usa comandos de Minecraft para crear efectos visuales, sonidos, daños y lógica de tiempo.
                        </p>
                        <div className="grid gap-2">
                            {data.functions.map((func, idx) => (
                                <div key={idx} className="glass-panel p-3 rounded-lg flex items-center justify-between group hover:border-purple-500/30 transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg border ${func.tag === 'none' ? 'bg-orange-500/10 border-orange-500/20' : func.tag === 'load' ? 'bg-cyan-500/10 border-cyan-500/20' : 'bg-purple-500/10 border-purple-500/20'}`}>
                                            {func.tag === 'load' ? <Play className="w-4 h-4 text-cyan-400" /> : 
                                             func.tag === 'tick' ? <Clock className="w-4 h-4 text-purple-400" /> :
                                             <Terminal className="w-4 h-4 text-orange-400" />}
                                        </div>
                                        <div>
                                             <div className="font-mono text-sm text-gray-300">
                                                {func.path}.mcfunction
                                            </div>
                                            {func.tag !== 'none' && (
                                                <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wide mt-0.5">
                                                    Runs on {func.tag}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => startEditingFunction(func)} className="p-1.5 hover:bg-white/10 rounded text-gray-300">
                                            <Edit2 className="w-4 h-4"/>
                                        </button>
                                        <button onClick={() => removeFunction(func.path)} className="p-1.5 hover:bg-red-500/20 rounded text-red-400">
                                            <Trash2 className="w-4 h-4"/>
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {data.functions.length === 0 && (
                                <div className="text-center py-8 border border-dashed border-white/10 rounded-lg">
                                    <p className="text-gray-600 text-sm">No hay funciones lógicas.</p>
                                </div>
                            )}
                        </div>
                     </>
                 )}
             </div>
        )}
      </div>
    </div>
  );
};
