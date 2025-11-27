import Airtable from 'airtable';

if (!process.env.AIRTABLE_API_KEY) {
	throw new Error('AIRTABLE_API_KEY is not set');
}

if (!process.env.AIRTABLE_BASE_ID) {
	throw new Error('AIRTABLE_BASE_ID is not set');
}

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
	process.env.AIRTABLE_BASE_ID
);

export interface AirtableTemplate {
	id: string;
	fields: {
		[key: string]: any;
	};
}

export const airtableClient = {
	/**
	 * Fetch all records from a table
	 */
	async fetchRecords(tableName: string): Promise<AirtableTemplate[]> {
		const records: AirtableTemplate[] = [];

		await base(tableName)
			.select()
			.eachPage((pageRecords, fetchNextPage) => {
				pageRecords.forEach((record) => {
					records.push({
						id: record.id,
						fields: record.fields,
					});
				});
				fetchNextPage();
			});

		return records;
	},

	/**
	 * Fetch records with a filter formula
	 */
	async fetchFilteredRecords(
		tableName: string,
		filterFormula: string
	): Promise<AirtableTemplate[]> {
		const records: AirtableTemplate[] = [];

		await base(tableName)
			.select({ filterByFormula: filterFormula })
			.eachPage((pageRecords, fetchNextPage) => {
				pageRecords.forEach((record) => {
					records.push({
						id: record.id,
						fields: record.fields,
					});
				});
				fetchNextPage();
			});

		return records;
	},

	/**
	 * Get a single record by ID
	 */
	async getRecord(
		tableName: string,
		recordId: string
	): Promise<AirtableTemplate> {
		const record = await base(tableName).find(recordId);
		return {
			id: record.id,
			fields: record.fields,
		};
	},
};
