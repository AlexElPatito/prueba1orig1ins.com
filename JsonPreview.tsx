import React, { useState, useMemo } from 'react';
import { OriginData } from '../types';
import { Copy, Check, FileJson, Folder, Terminal, Download, Box, FileText, Layers, Tag, Stethoscope, AlertTriangle, Loader2 } from 'lucide-react';
import JSZip from 'jszip';
import { validateAndFixDatapack } from '../services/gemini';

interface JsonPreviewProps {
  data: OriginData;
  onUpdateData?: (newData: OriginData) => void;
}

interface FolderItemProps {
  name: string;
  children: React.ReactNode;
  color?: string;
}

const FolderItem: React.FC<FolderItemProps> = ({ name, children, color = "text-gray-500" }) => (
    <div className="mt-1">
        <div className={`flex items-center gap-2 px-2 py-1 ${color}`}>
            <Folder className="w-3 h-3" />
            <span className="text-xs font-semibold">{name}</span>
        </div>
        <div className="ml-3 border-l border-white/5 pl-2">
            {children}
        </div>
    </div>
);

interface FileItemProps {
  name: string;
  path: string;
  icon: any;
  activeColor: string;
  selectedFile: string;
  onSelect: (path: string) => void;
}

const FileItem: React.FC<FileItemProps> = ({ name, path, icon: Icon, activeColor, selectedFile, onSelect }) => (
    <div 
        onClick={() => onSelect(path)}
        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-all truncate text-xs font-mono mb-0.5
          ${selectedFile === path 
            ? `bg-${activeColor}-500/20 text-${activeColor}-300 shadow-[0_0_10px_rgba(0,0,0,0.2)]` 
            : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
          }`}
    >
        <Icon className="w-3 h-3 flex-none" />
        <span className="truncate">{name}</span>
    </div>
);

export const JsonPreview: React.FC<JsonPreviewProps> = ({ data, onUpdateData }) => {
  const [copied, setCopied] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  // Robust namespace derivation
  const cleanName = data.name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const namespace = data.namespace && /^[a-z0-9_]+$/.test(data.namespace) 
    ? data.namespace 
    : cleanName || 'mypack';

  // State to track selected file in explorer
  // We use the full virtual path as ID
  const [selectedFile, setSelectedFile] = useState<string>(`data/${namespace}/origins/${cleanName}.json`);

  const getPowerName = (id: string) => {
      const parts = id.split(':');
      return parts.length > 1 ? parts[1] : parts[0];
  };

  /**
   * Virtual File System Resolver
   * Maps a path string to the actual content content based on OriginData
   */
  const getFileContent = (filepath: string): string => {
      // 1. Pack Metadata
      if (filepath === 'pack.mcmeta') {
          return JSON.stringify({
              pack: {
                  pack_format: data.packFormat || 15,
                  description: data.description
              }
          }, null, 2);
      }

      // 2. Origin Layer (CRITICAL: Must be in data/origins/origin_layers/origin.json)
      if (filepath === `data/origins/origin_layers/origin.json`) {
          return JSON.stringify({
              replace: false,
              origins: [`${namespace}:${cleanName}`]
          }, null, 2);
      }

      // 3. Minecraft Tags (Load/Tick)
      if (filepath === 'data/minecraft/tags/functions/load.json') {
          const loadFuncs = data.functions.filter(f => f.tag === 'load').map(f => `${namespace}:${f.path}`);
          return JSON.stringify({ values: loadFuncs }, null, 2);
      }
      if (filepath === 'data/minecraft/tags/functions/tick.json') {
          const tickFuncs = data.functions.filter(f => f.tag === 'tick').map(f => `${namespace}:${f.path}`);
          return JSON.stringify({ values: tickFuncs }, null, 2);
      }

      // 4. Origin Definition (Inside Custom Namespace)
      if (filepath === `data/${namespace}/origins/${cleanName}.json`) {
           return JSON.stringify({
            powers: data.powers,
            icon: { item: data.icon },
            order: 10,
            impact: data.impact,
            name: data.name,
            description: data.description
          }, null, 2);
      }

      // 5. Custom Powers
      const powerPrefix = `data/${namespace}/powers/`;
      if (filepath.startsWith(powerPrefix)) {
          const filename = filepath.substring(powerPrefix.length);
          const powerName = filename.replace('.json', '');
          const power = data.customPowers.find(p => getPowerName(p.id) === powerName);
          if (power) return power.json;
      }

      // 6. Functions
      const funcPrefix = `data/${namespace}/functions/`;
      if (filepath.startsWith(funcPrefix)) {
          const funcPathWithExt = filepath.substring(funcPrefix.length);
          const funcPath = funcPathWithExt.replace('.mcfunction', '');
          const func = data.functions.find(f => f.path === funcPath);
          if (func) return func.content;
      }

      return "{}";
  };

  const currentContent = getFileContent(selectedFile);

  const totalSizeKB = useMemo(() => {
    let size = 0;
    size += getFileContent('pack.mcmeta').length;
    size += getFileContent(`data/origins/origin_layers/origin.json`).length;
    size += getFileContent(`data/${namespace}/origins/${cleanName}.json`).length;
    data.customPowers.forEach(p => size += p.json.length);
    data.functions.forEach(f => size += f.content.length);
    return (size / 1024).toFixed(2);
  }, [data, namespace, cleanName]);

  // --- ACTIONS ---

  const handleCopy = () => {
    navigator.clipboard.writeText(currentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCheckAndRepair = async () => {
    if (!onUpdateData) return;
    setIsChecking(true);
    try {
        const fixedFunctions = await validateAndFixDatapack(data);
        onUpdateData({ ...data, functions: fixedFunctions });
        alert("¡Verificación completa! Se ha actualizado la lógica.");
    } catch (error) {
        console.error(error);
        alert("Error al verificar archivos.");
    } finally {
        setIsChecking(false);
    }
  };

  const handleDownloadZip = async () => {
      setIsZipping(true);
      try {
          const zip = new JSZip();
          
          // Root: pack.mcmeta
          zip.file("pack.mcmeta", getFileContent('pack.mcmeta'));
          
          const dataFolder = zip.folder("data");
          if (!dataFolder) throw new Error("Failed to create data folder");

          // 1. MINECRAFT Namespace (Tags)
          // Only create if needed
          const loadFuncs = data.functions.filter(f => f.tag === 'load');
          const tickFuncs = data.functions.filter(f => f.tag === 'tick');
          
          if (loadFuncs.length > 0 || tickFuncs.length > 0) {
              const mcTagsFolder = dataFolder.folder("minecraft")?.folder("tags")?.folder("functions");
              if (loadFuncs.length > 0) mcTagsFolder?.file("load.json", getFileContent("data/minecraft/tags/functions/load.json"));
              if (tickFuncs.length > 0) mcTagsFolder?.file("tick.json", getFileContent("data/minecraft/tags/functions/tick.json"));
          }

          // 2. ORIGINS Namespace (Layer Registration)
          // This is essential for the Origin to show up in the menu without overwriting anything
          const originsNsFolder = dataFolder.folder("origins");
          originsNsFolder?.folder("origin_layers")?.file("origin.json", getFileContent(`data/origins/origin_layers/origin.json`));

          // 3. CUSTOM Namespace (The Content)
          const customNsFolder = dataFolder.folder(namespace);
          
          // 3a. Origin Definition
          customNsFolder?.folder("origins")?.file(`${cleanName}.json`, getFileContent(`data/${namespace}/origins/${cleanName}.json`));

          // 3b. Powers
          if (data.customPowers.length > 0) {
              const powersFolder = customNsFolder?.folder("powers");
              data.customPowers.forEach(p => {
                  const name = getPowerName(p.id);
                  powersFolder?.file(`${name}.json`, p.json);
              });
          }

          // 3c. Functions
          if (data.functions.length > 0) {
              const functionsFolder = customNsFolder?.folder("functions");
              data.functions.forEach(f => {
                  // Support nested paths (e.g. "utils/math/add")
                  const parts = f.path.split('/');
                  const fileName = parts.pop() + ".mcfunction";
                  let currentDir = functionsFolder;
                  // Traverse/Create folders
                  parts.forEach(part => { 
                      currentDir = currentDir?.folder(part) || null; 
                  });
                  if (currentDir) currentDir.file(fileName, f.content);
              });
          }

          // Generate
          const content = await zip.generateAsync({ type: "blob" });
          const url = window.URL.createObjectURL(content);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${namespace}_Datapack.zip`;
          a.click();
          window.URL.revokeObjectURL(url);

      } catch (error) {
          console.error(error);
          alert("Error generando el archivo ZIP.");
      } finally {
          setIsZipping(false);
      }
  };

  return (
    <div className="h-full flex gap-6">
      {/* 1. File Explorer Pane */}
      <div className="w-72 flex-none glass-panel rounded-xl flex flex-col overflow-hidden bg-[#050505]/50 border-r border-white/10">
         <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20 backdrop-blur-md">
             <div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest block">Explorer</span>
                <span className="text-[10px] text-gray-600 font-mono mt-0.5">{totalSizeKB} KB Total</span>
             </div>
             <Box className="w-4 h-4 text-cyan-500" />
         </div>
         <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
             {/* Root Files */}
             <FileItem 
                name="pack.mcmeta" 
                path="pack.mcmeta" 
                icon={FileText} 
                activeColor="gray"
                selectedFile={selectedFile}
                onSelect={setSelectedFile}
             />

             {/* DATA Root */}
             <FolderItem name="data" color="text-gray-300">
                 
                 {/* MINECRAFT (Tags) */}
                 {(data.functions.some(f => f.tag === 'load') || data.functions.some(f => f.tag === 'tick')) && (
                     <FolderItem name="minecraft" color="text-orange-400/80">
                         <FolderItem name="tags" color="text-orange-400/70">
                             <FolderItem name="functions" color="text-orange-400/60">
                                 {data.functions.some(f => f.tag === 'load') && (
                                     <FileItem 
                                        name="load.json" 
                                        path="data/minecraft/tags/functions/load.json" 
                                        icon={Tag} 
                                        activeColor="orange"
                                        selectedFile={selectedFile}
                                        onSelect={setSelectedFile}
                                     />
                                 )}
                                 {data.functions.some(f => f.tag === 'tick') && (
                                      <FileItem 
                                        name="tick.json" 
                                        path="data/minecraft/tags/functions/tick.json" 
                                        icon={Tag} 
                                        activeColor="orange"
                                        selectedFile={selectedFile}
                                        onSelect={setSelectedFile}
                                     />
                                 )}
                             </FolderItem>
                         </FolderItem>
                     </FolderItem>
                 )}

                 {/* ORIGINS (Registration Layer) */}
                 <FolderItem name="origins" color="text-yellow-500/80">
                     <FolderItem name="origin_layers" color="text-yellow-500/60">
                         <FileItem 
                            name="origin.json" 
                            path={`data/origins/origin_layers/origin.json`}
                            icon={Layers} 
                            activeColor="yellow"
                            selectedFile={selectedFile}
                            onSelect={setSelectedFile}
                         />
                     </FolderItem>
                 </FolderItem>

                 {/* CUSTOM NAMESPACE (Content) */}
                 <FolderItem name={namespace} color="text-emerald-500">
                     
                     {/* Origins */}
                     <FolderItem name="origins" color="text-emerald-500/80">
                         <FileItem 
                            name={`${cleanName}.json`}
                            path={`data/${namespace}/origins/${cleanName}.json`}
                            icon={FileJson} 
                            activeColor="emerald"
                            selectedFile={selectedFile}
                            onSelect={setSelectedFile}
                         />
                     </FolderItem>

                     {/* Powers */}
                     {data.customPowers.length > 0 && (
                         <FolderItem name="powers" color="text-cyan-500/80">
                             {data.customPowers.map(p => {
                                 const name = getPowerName(p.id);
                                 return (
                                     <FileItem 
                                        key={p.id}
                                        name={`${name}.json`}
                                        path={`data/${namespace}/powers/${name}.json`}
                                        icon={FileJson} 
                                        activeColor="cyan"
                                        selectedFile={selectedFile}
                                        onSelect={setSelectedFile}
                                     />
                                 );
                             })}
                         </FolderItem>
                     )}

                     {/* Functions */}
                     {data.functions.length > 0 && (
                         <FolderItem name="functions" color="text-purple-500/80">
                             {data.functions.map(f => (
                                 <FileItem 
                                    key={f.path}
                                    name={`${f.path}.mcfunction`}
                                    path={`data/${namespace}/functions/${f.path}.mcfunction`}
                                    icon={Terminal} 
                                    activeColor="purple"
                                    selectedFile={selectedFile}
                                    onSelect={setSelectedFile}
                                 />
                             ))}
                         </FolderItem>
                     )}
                 </FolderItem>
             </FolderItem>
         </div>
      </div>

      {/* 2. Code Viewer Pane */}
      <div className="flex-1 flex flex-col space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between bg-black/20 p-4 rounded-xl border border-white/5 backdrop-blur-sm">
            <div className="overflow-hidden">
                <h2 className="text-lg font-bold text-white flex items-center gap-2 truncate">
                    {selectedFile.endsWith('.mcfunction') 
                        ? <Terminal className="w-5 h-5 text-purple-400"/> 
                        : <FileJson className="w-5 h-5 text-cyan-400"/>}
                    <span className="truncate">{selectedFile.split('/').pop()}</span>
                </h2>
                <p className="text-xs text-gray-500 font-mono mt-1 truncate max-w-2xl" title={selectedFile}>
                    {selectedFile}
                </p>
            </div>
            <div className="flex gap-3 flex-none">
                {onUpdateData && (
                    <button
                        onClick={handleCheckAndRepair}
                        disabled={isChecking}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border border-orange-500/30 text-orange-200 hover:text-white hover:bg-orange-600/30 rounded-lg transition-all"
                        title="Verificar integridad de archivos y reparar funciones faltantes"
                    >
                        {isChecking ? <Loader2 className="w-4 h-4 animate-spin"/> : <Stethoscope className="w-4 h-4"/>}
                        {isChecking ? 'Verificando...' : 'Scan & Repair'}
                    </button>
                )}
                
                <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-colors border border-white/5"
                >
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
                
                <button
                onClick={handleDownloadZip}
                disabled={isZipping}
                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white rounded-lg transition-all shadow-lg shadow-purple-900/30 font-semibold"
                >
                    {isZipping ? <Box className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4" />}
                    {isZipping ? 'Comprimiendo...' : 'Descargar ZIP'}
                </button>
            </div>
        </div>
        
        {/* Code Block */}
        <div className="flex-1 relative bg-[#050505] rounded-xl border border-white/10 overflow-hidden font-mono text-sm shadow-inner group">
            <div className="absolute inset-0 overflow-auto p-6 custom-scrollbar">
            <pre>
                <code className="text-gray-300">
                {currentContent.split('\n').map((line, i) => {
                    // Simple Syntax Highlighting
                    if (selectedFile.endsWith('.json') || selectedFile.endsWith('.mcmeta')) {
                        const parts = line.split(':');
                        if (parts.length > 1 && !line.includes('{') && !line.includes('}')) {
                            const key = parts[0];
                            const val = parts.slice(1).join(':');
                            return (
                                <div key={i}>
                                    <span className="text-cyan-300">{key}</span>:
                                    <span className="text-emerald-300">{val}</span>
                                </div>
                            );
                        }
                    } else if (selectedFile.endsWith('.mcfunction')) {
                        if (line.trim().startsWith('#')) return <div key={i} className="text-gray-500 italic">{line}</div>
                        if (line.trim().startsWith('execute')) return <div key={i}><span className="text-purple-400">execute</span>{line.substring(7)}</div>
                        if (line.trim().startsWith('function')) return <div key={i}><span className="text-yellow-400">function</span>{line.substring(8)}</div>
                        if (line.trim().startsWith('scoreboard')) return <div key={i}><span className="text-red-400">scoreboard</span>{line.substring(10)}</div>
                        if (line.trim().startsWith('tellraw') || line.trim().startsWith('title')) return <div key={i}><span className="text-green-400">{line.split(' ')[0]}</span>{line.substring(line.indexOf(' '))}</div>
                    }
                    return <div key={i}>{line}</div>
                })}
                </code>
            </pre>
            </div>
        </div>
      </div>
    </div>
  );
};
