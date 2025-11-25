import { GoogleGenAI, Type } from "@google/genai";
import { MapData } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const LEVEL_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    missionName: { type: Type.STRING },
    briefing: { type: Type.STRING },
    mapGrid: {
      type: Type.ARRAY,
      items: {
        type: Type.ARRAY,
        items: { type: Type.INTEGER }
      }
    },
    floorColor: { type: Type.STRING },
    ceilingColor: { type: Type.STRING }
  },
  required: ["missionName", "briefing", "mapGrid", "floorColor", "ceilingColor"]
};

export const generateMission = async (): Promise<{
  map: MapData,
  name: string,
  brief: string
}> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Generate a cyberpunk FPS level layout. 
      The grid should be roughly 16x16. 
      0 represents empty space. 
      1, 2, 3, 4 represent different wall types (neon tech walls).
      The map should be enclosed by walls.
      Provide a cool cyberpunk mission name and a 2-sentence briefing involving "anthropomorphic synth-creatures" taking over the sector.
      Colors should be valid hex codes, dark and neon.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: LEVEL_SCHEMA,
        systemInstruction: "You are a Cyberpunk Game Master AI. Design cool, enclosed levels.",
      }
    });

    const data = JSON.parse(response.text || '{}');
    
    // Validate/Patch grid
    const grid = data.mapGrid || [
      [1,1,1,1,1],
      [1,0,0,0,1],
      [1,0,0,0,1],
      [1,1,1,1,1]
    ];
    
    // Ensure bounds
    const width = grid[0].length;
    const height = grid.length;

    return {
      map: {
        grid,
        width,
        height,
        floorColor: data.floorColor || '#1a1a1a',
        ceilingColor: data.ceilingColor || '#050505'
      },
      name: data.missionName || "Operation: Neon Dawn",
      brief: data.briefing || "Infiltrate the sector. Eliminate all threats."
    };
  } catch (e) {
    console.error("Gemini Level Gen Failed:", e);
    // Fallback level
    return {
      map: {
        grid: [
          [1,1,1,1,1,1,1,1],
          [1,0,0,0,0,0,0,1],
          [1,0,2,0,3,0,0,1],
          [1,0,0,0,0,0,0,1],
          [1,0,4,0,0,2,0,1],
          [1,0,0,0,0,0,0,1],
          [1,0,0,0,0,0,0,1],
          [1,1,1,1,1,1,1,1],
        ],
        width: 8,
        height: 8,
        floorColor: '#222',
        ceilingColor: '#111'
      },
      name: "Fallback Protocol",
      brief: "Connection to HQ lost. Proceed with caution."
    };
  }
};

export const generateEnemyBark = async (situation: 'SPOT' | 'HIT' | 'DEATH', enemyType: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Generate a very short (max 5 words) bark for a cyberpunk ${enemyType} enemy who just experienced: ${situation}.`,
      config: {
        maxOutputTokens: 20,
      }
    });
    return response.text.trim();
  } catch {
    return "...";
  }
};
