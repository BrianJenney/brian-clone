import { StateGraph, START, END, MemorySaver } from '@langchain/langgraph';

import { graphStateSchema } from './types';
import {
	classifyIntent,
	executeTools,
	handleTypeform,
	generateResponse,
	routeAfterClassification,
	routeAfterTypeform,
} from './nodes';

export const checkpointer = new MemorySaver();

export const chatGraph = new StateGraph(graphStateSchema)
	.addNode('classifyIntent', classifyIntent)
	.addNode('executeTools', executeTools)
	.addNode('handleTypeform', handleTypeform)
	.addNode('generateResponse', generateResponse)
	.addEdge(START, 'classifyIntent')
	.addConditionalEdges('classifyIntent', routeAfterClassification)
	.addEdge('executeTools', 'generateResponse')
	.addConditionalEdges('handleTypeform', routeAfterTypeform)
	.addEdge('generateResponse', END)
	.compile({ checkpointer });
