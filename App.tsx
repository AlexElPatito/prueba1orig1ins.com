import React, { useState } from 'react';
import { OriginData, Tab } from './types';
import { generateOriginFromPrompt } from './services/gemini';
import { OriginEditor } from './components/OriginEditor';
import { JsonPreview } from './components/JsonPreview';
import { ChatWidget } from './components/ChatWidget';
import { Box, FileJson, Layers } from 'lucide-react';

const INITIAL_DATA: OriginData = {
  name: 'Nuevo Origin',
  namespace: 'custom_origin',
  description: 'Un nuevo origin personalizado.',
  icon: 'minecraft:grass_block',
  impact: 1,
  packFormat: 15,
  powers: [],
  customPowers: [],
  functions: []
};

function App() {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.EDITOR);
  const [originData, setOriginData] = useState<OriginData>(INITIAL_DATA);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async (prompt: string) => {
    setIsGenerating(true);
    try {
      const newData = await generateOriginFromPrompt(prompt);
      setOriginData(newData);
    } catch (error) {
      console.error("Failed to generate origin", error);
      alert("Error generando el Origin. Por favor intenta de nuevo.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-full text-gray-200 font-sans">
      {/* Glass Header */}
      <header className="flex-none h-16 glass-panel border-b-0 flex items-center px-6 justify-between z-20 mx-4 mt-4 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-purple-900/40">
            <Layers className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white leading-tight">
              Origins <span className="text-cyan-400">Architect</span>
            </h1>
            <p className="text-[10px] text-gray-400 tracking-wider uppercase font-medium">AI Datapack Generator</p>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-black/20 p-1 rounded-lg border border-white/5">
          <button
            onClick={() => setActiveTab(Tab.EDITOR)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === Tab.EDITOR
                ? 'bg-gradient-to-r from-cyan-600/20 to-purple-600/20 text-white border border-white/10 shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Box className="w-4 h-4" />
            Editor
          </button>
          <button
            onClick={() => setActiveTab(Tab.PREVIEW)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === Tab.PREVIEW
                ? 'bg-gradient-to-r from-cyan-600/20 to-purple-600/20 text-white border border-white/10 shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <FileJson className="w-4 h-4" />
            Datapack & ZIP
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        <div className="max-w-7xl mx-auto h-full p-4 lg:p-6">
          {activeTab === Tab.EDITOR ? (
            <div className="h-full overflow-y-auto pr-2 custom-scrollbar pb-20">
              <OriginEditor
                data={originData}
                onChange={setOriginData}
                onGenerate={handleGenerate}
                isGenerating={isGenerating}
              />
            </div>
          ) : (
            <div className="h-full pb-6">
              <JsonPreview 
                data={originData} 
                onUpdateData={setOriginData}
              />
            </div>
          )}
        </div>
      </main>

      {/* Floating Chat */}
      <ChatWidget />
    </div>
  );
}

export default App;