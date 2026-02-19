/**
 * Agent configuration
 * Single source of truth for available agents and their metadata
 */

export const AGENT_CONFIG = {
	videoResearch: {
		name: 'videoResearch',
		displayName: 'Video Research',
		description:
			'Analyze YouTube channel performance and research video topics',
		tools: ['analyzeChannelTool', 'researchTopicTool'],
	},
	businessContext: {
		name: 'businessContext',
		displayName: 'Business Context',
		description:
			'Fetch business data, audience persona, and performance metrics',
		tools: ['getBusinessContextTool'],
	},
	writingSamples: {
		name: 'writingSamples',
		displayName: 'Writing Samples',
		description: "Search Brian's writing samples to match style and voice",
		tools: ['searchWritingSamplesTool'],
	},
	resources: {
		name: 'resources',
		displayName: 'Resources',
		description: 'Find learning resources, courses, guides, and tutorials',
		tools: ['searchResourcesTool'],
	},
	excalidrawer: {
		name: 'excalidrawer',
		displayName: 'Excalidrawer',
		description: 'Draw diagrams and flowcharts',
		tools: ['excalidrawerTool'],
	},
} as const;

// Derive types from config
export type AgentName = keyof typeof AGENT_CONFIG;

export type AgentConfig = (typeof AGENT_CONFIG)[AgentName];

/**
 * Get agent metadata
 */
export function getAgentConfig(name: AgentName): AgentConfig {
	return AGENT_CONFIG[name];
}

/**
 * Get all agent names as array
 */
export function getAgentNames(): AgentName[] {
	return Object.keys(AGENT_CONFIG) as AgentName[];
}
