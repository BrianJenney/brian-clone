import { openai } from '@ai-sdk/openai';
import { generateObject, tool } from 'ai';
import { z } from 'zod';

export const excalidrawerTool = tool({
	description:
		'Excalidrawer is a tool that allows you to draw diagrams and flowcharts.',
	inputSchema: z.object({
		request: z
			.string()
			.describe('What kind of diagram do you want to create?'),
	}),
	execute: async (args: { request: string }) => {
		const { request } = args;

		const SYSTEM_PROMPT = `
        Here's an example of an excalidraw drawing:
        {
            "type": "excalidraw",
            "version": 2,
            "source": "https://excalidraw.com",
            "elements": [
                {
                "id": "1",
                "type": "rectangle",
                "x": 100,
                "y": 100,
                "width": 200,
                "height": 100,
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
                "x": 130,
                "y": 135,
                "width": 140,
                "height": 30,
                "text": "Hello World",
                "fontSize": 20,
                "fontFamily": 1,
                "textAlign": "center",
                "verticalAlign": "middle",
                "strokeColor": "#ffffff"
                }
            ],
            "appState": {
                "viewBackgroundColor": "#ffffff"
            }
        }
        Here's the request: ${request} for the kind of diagram you need to create.

        Prefer simple styling, minimal colors, and a clean design.
        `;

		const result = await generateObject({
			model: openai('gpt-5'),
			schema: z.object({
				diagram: z.record(z.string(), z.any()),
			}),
			prompt: SYSTEM_PROMPT,
		});

		return result.object.diagram;
	},
});
