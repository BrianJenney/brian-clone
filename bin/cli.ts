#!/usr/bin/env tsx

/**
 * Brian CLI - Search for articles from the command line
 * Usage: brian "search query" [options]
 */

import { performSearch } from '../libs/search';
import { SearchResult } from '../libs/schemas';

// Parse command line arguments
const args = process.argv.slice(2);

function printHelp() {
	console.log(`
Brian CLI - Search for articles from the command line

Usage:
  brian "search query"                    Search across all content types
  brian "search query" --limit 20         Limit number of results (default: 10)
  brian "search query" --type article     Search only articles
  brian "search query" --type post        Search only posts
  brian "search query" --type transcript  Search only transcripts
  brian "search query" --author "Name"    Filter by author
  brian "search query" --tag "javascript" Filter by tag
  brian --help                            Show this help message

Options:
  --limit <n>       Number of results to return (1-100, default: 10)
  --type <type>     Content type to search: article, post, or transcript
  --author <name>   Filter by author name
  --tag <tag>       Filter by tag
  --json            Output results as JSON instead of table
  --help, -h        Show this help message

Examples:
  brian "machine learning"
  brian "react hooks" --limit 5
  brian "typescript" --type article
  brian "AI" --author "Brian" --limit 20
	`);
}

function formatTable(results: SearchResult[]) {
	if (results.length === 0) {
		console.log('\nNo results found.\n');
		return;
	}

	console.log(`\nFound ${results.length} results:\n`);

	// Calculate column widths
	const maxTitleWidth = 50;
	const maxSnippetWidth = 80;

	// Print header
	console.log(
		'─'.repeat(maxTitleWidth + maxSnippetWidth + 30)
	);
	console.log(
		`${'TITLE'.padEnd(maxTitleWidth)} ${'SNIPPET'.padEnd(maxSnippetWidth)} ${'TYPE'.padEnd(10)} SCORE`
	);
	console.log(
		'─'.repeat(maxTitleWidth + maxSnippetWidth + 30)
	);

	// Print each result
	for (const result of results) {
		const title = (result.metadata?.title as string) || 'Untitled';
		const titleTruncated =
			title.length > maxTitleWidth
				? title.substring(0, maxTitleWidth - 3) + '...'
				: title.padEnd(maxTitleWidth);

		const snippet = result.text.replace(/\n/g, ' ').trim();
		const snippetTruncated =
			snippet.length > maxSnippetWidth
				? snippet.substring(0, maxSnippetWidth - 3) + '...'
				: snippet.padEnd(maxSnippetWidth);

		const type = result.contentType.padEnd(10);
		const score = result.score.toFixed(3);

		console.log(`${titleTruncated} ${snippetTruncated} ${type} ${score}`);
	}

	console.log(
		'─'.repeat(maxTitleWidth + maxSnippetWidth + 30)
	);
	console.log();
}

async function main() {
	try {
		// Check for help flag
		if (args.includes('--help') || args.includes('-h')) {
			printHelp();
			process.exit(0);
		}

		// Get the search query (first non-flag argument)
		const queryIndex = args.findIndex((arg) => !arg.startsWith('--'));
		if (queryIndex === -1) {
			console.error('Error: Please provide a search query.');
			console.log('Run "brian --help" for usage information.');
			process.exit(1);
		}

		const query = args[queryIndex];

		// Parse flags
		let limit = 10;
		let collections: ('article' | 'post' | 'transcript')[] | undefined;
		let author: string | undefined;
		let tags: string[] | undefined;
		let jsonOutput = false;

		for (let i = 0; i < args.length; i++) {
			const arg = args[i];

			if (arg === '--limit' && args[i + 1]) {
				limit = parseInt(args[i + 1], 10);
				if (isNaN(limit) || limit < 1 || limit > 100) {
					console.error('Error: --limit must be a number between 1 and 100');
					process.exit(1);
				}
				i++;
			} else if (arg === '--type' && args[i + 1]) {
				const type = args[i + 1];
				if (!['article', 'post', 'transcript'].includes(type)) {
					console.error(
						'Error: --type must be "article", "post", or "transcript"'
					);
					process.exit(1);
				}
				collections = [type as 'article' | 'post' | 'transcript'];
				i++;
			} else if (arg === '--author' && args[i + 1]) {
				author = args[i + 1];
				i++;
			} else if (arg === '--tag' && args[i + 1]) {
				tags = [args[i + 1]];
				i++;
			} else if (arg === '--json') {
				jsonOutput = true;
			}
		}

		// Perform search
		const response = await performSearch({
			query,
			collections,
			limit,
			filter: author || tags ? { author, tags } : undefined,
		});

		// Output results
		if (jsonOutput) {
			console.log(JSON.stringify(response, null, 2));
		} else {
			formatTable(response.results);
		}
	} catch (error) {
		console.error('Error:', error instanceof Error ? error.message : error);
		process.exit(1);
	}
}

main();
