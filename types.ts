
export interface CustomPower {
  id: string; // e.g. "mypack:fireball"
  name: string; // Display name
  type: string; // e.g. "origins:active_self"
  json: string; // Full JSON content
}

export interface CustomFunction {
  path: string; // e.g. "utils/calculate_damage" (relative to functions folder)
  content: string; // The .mcfunction content
  tag: 'none' | 'load' | 'tick'; // Determines if it goes into minecraft/tags/functions
}

export interface OriginData {
  name: string;
  namespace: string; // NEW: Explicit namespace definition
  description: string;
  icon: string;
  impact: number; // 0 = none, 1 = low, 2 = medium, 3 = high
  packFormat: number; // pack.mcmeta format
  powers: string[]; // List of power IDs (standard + custom)
  customPowers: CustomPower[]; // Definitions for custom powers
  functions: CustomFunction[]; // .mcfunction files
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  sources?: {
    uri: string;
    title: string;
  }[];
}

export enum Tab {
  EDITOR = 'editor',
  PREVIEW = 'preview',
}

// --- ORIGINS SCRIPT MIDDLEWARE TYPES ---

export type ScriptPowerTemplate = 
  | 'immunity' 
  | 'attribute' 
  | 'damage_over_time' 
  | 'launch' 
  | 'toggle' 
  | 'passive' 
  | 'resource'
  | 'phantom'
  | 'climbing'
  | 'night_vision'
  | 'water_breathing';

export interface ScriptPower {
  slug: string; // Short ID, e.g. "fire_proof"
  name: string; // Display name
  description: string;
  template: ScriptPowerTemplate | 'custom';
  // Dynamic properties based on template
  params?: {
    source?: string; // For immunity (fire, cactus, etc)
    amount?: number; // For attribute/damage
    condition?: string; // water, sun, night, day
    attribute?: string; // generic.max_health, etc.
    key?: string; // primary, secondary
    cooldown?: number;
    resource_max?: number;
    active_by_default?: boolean;
  };
}

export interface OriginsScript {
  meta: {
    name: string;
    id: string; // namespace
    description: string;
    icon: string;
    impact: number;
  };
  powers: ScriptPower[];
}
