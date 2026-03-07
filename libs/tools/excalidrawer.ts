import { tool } from '@langchain/core/tools';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';

const llm = new ChatOpenAI({ model: 'gpt-5' });

const EXCALIDRAW_EXAMPLE = `{
  "type": "excalidraw",
  "version": 2,
  "source": "https://excalidraw.com",
  "elements": [
    {
      "id": "1",
      "type": "rectangle",
      "x": 100, "y": 100, "width": 200, "height": 100,
      "strokeColor": "#000000",
      "backgroundColor": "#1976d2",
      "fillStyle": "hachure",
      "strokeWidth": 2,
      "roughness": 1,
      "opacity": 100,
      "version": 1,
      "versionNonce": 12345,
      "isDeleted": false,
      "groupIds": []
    },
    {
      "id": "2",
      "type": "text",
      "x": 130, "y": 135, "width": 140, "height": 30,
      "text": "Hello World",
      "fontSize": 20,
      "fontFamily": 1,
      "textAlign": "center",
      "verticalAlign": "middle",
      "strokeColor": "#ffffff"
    }
  ],
  "appState": { "viewBackgroundColor": "#ffffff" }
}`;

export const excalidrawerTool = tool(
	async (args: { request: string }) => {
		const SYSTEM_PROMPT = `Here's an example of an excalidraw drawing:\n${EXCALIDRAW_EXAMPLE}\n\nHere's the request: ${args.request}\n\nPrefer simple styling, minimal colors, and a clean design.`;

		const result = await llm
			.withStructuredOutput(z.object({ diagram: z.record(z.string(), z.any()) }))
			.invoke(SYSTEM_PROMPT);

		return JSON.stringify(result.diagram);
	},
	{
		name: 'excalidrawerTool',
		description: 'Draw diagrams and flowcharts using Excalidraw format.',
		schema: z.object({
			request: z.string().describe('What kind of diagram do you want to create?'),
		}),
	},
);
