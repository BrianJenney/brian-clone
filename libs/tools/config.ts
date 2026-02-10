/**
 * Tool configuration and metadata
 * Shared between backend tool definitions and frontend display
 */

export type ToolName =
	| 'searchWritingSamplesTool'
	| 'getBusinessContextTool'
	| 'searchResourcesTool'
	| 'analyzeChannelTool'
	| 'researchTopicTool'
	| 'excalidrawerTool';

export type ToolMetadata = {
	name: ToolName;
	displayName: string;
	description: string;
};

export const TOOL_CONFIG: Record<ToolName, ToolMetadata> = {
	searchWritingSamplesTool: {
		name: 'searchWritingSamplesTool',
		displayName: 'searching writing samples',
		description: `Search through Brian's writing samples`,
	},
	getBusinessContextTool: {
		name: 'getBusinessContextTool',
		displayName: 'fetching business context',
		description: 'Fetch business context and data',
	},
	searchResourcesTool: {
		name: 'searchResourcesTool',
		displayName: 'searching resources',
		description: 'Search learning resources',
	},
	analyzeChannelTool: {
		name: 'analyzeChannelTool',
		displayName: 'analyzing YouTube channel',
		description: 'Analyze YouTube channel performance',
	},
	researchTopicTool: {
		name: 'researchTopicTool',
		displayName: 'researching YouTube topics',
		description: 'Research YouTube video topics',
	},
	excalidrawerTool: {
		name: 'excalidrawerTool',
		displayName: 'drawing diagrams',
		description: 'Draw diagrams and flowcharts',
	},
};

/**
 * Get display name for a tool
 * Handles both with and without "Tool" suffix
 */
export function getToolDisplayName(toolName: string): string {
	// Remove "Tool" suffix if present
	const cleanName = toolName.replace(/Tool$/, '');
	const withSuffix = `${cleanName}Tool` as ToolName;

	return TOOL_CONFIG[withSuffix]?.displayName || toolName;
}
