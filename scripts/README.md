# Upload Scripts

This directory contains scripts for bulk uploading content directly to Qdrant.

**Note:** These scripts write directly to your Qdrant database and do NOT require the dev server to be running.

## LinkedIn Posts Upload

Upload LinkedIn posts from a CSV file directly to the `brian-posts` collection.

### CSV Format

Your CSV file should have the following columns (header row required):

```csv
text,title,date,tags,url
```

- **text** (required): The full post content
- **title** (optional): A title for the post
- **date** (optional): Publication date (any format)
- **tags** (optional): Comma-separated tags (e.g., "ai,tech,startup")
- **url** (optional): Link to the original LinkedIn post

### Usage

1. Create your CSV file in the `data/` directory (see `linkedin-posts-example.csv` for reference)

2. Run the upload script:
   ```bash
   # Upload from default location (data/linkedin-posts.csv)
   yarn upload-linkedin

   # Or specify a custom CSV file
   yarn upload-linkedin path/to/your/posts.csv
   ```

### Example CSV

```csv
text,title,date,tags,url
"Your post content here with multiple lines and formatting...","Post Title","2024-10-15","ai,product","https://linkedin.com/posts/..."
"Another post content...","Another Title","2024-10-12","startup,tech",""
```

### How It Works

- Posts are stored in the `brian-posts` collection
- Posts are NOT chunked (stored as single vectors)
- Each post gets a 512-dimensional embedding from `text-embedding-3-small`
- Metadata (title, tags, dates, URLs) is stored in the payload

### Notes

- The script adds a 500ms delay between uploads to avoid overwhelming Qdrant
- Minimum post length: 10 characters
- Posts with quotes or commas in the text should be wrapped in double quotes

## Medium Posts Upload

Upload Medium articles from HTML files directly to the `brian-articles` collection.

### Usage

1. Place your Medium HTML exports in the `data/` directory

2. Run the upload script:
   ```bash
   yarn upload-posts
   ```

### How It Works

- Articles are stored in the `brian-articles` collection
- Articles ARE chunked into 1500 character segments with sentence overlap
- Each chunk gets a 512-dimensional embedding from `text-embedding-3-small`
- The script will:
  - Parse all `.html` files in the `data/` directory
  - Extract article content from the HTML
  - Skip posts shorter than 500 characters
  - Create multiple chunks per article with overlap

## Transcript Upload

For transcript uploads, you can use the Upload UI in the web interface or create a similar script following the pattern above, targeting the `brian-transcripts` collection.

### Output

Both scripts provide detailed progress output:

```
[1/3] Processing: my-article.html
  📦 Creating 3 chunk(s)
  ✅ Uploaded successfully (4523 chars)

==================================================
Upload complete!
  ✅ Successful: 3
  ❌ Failed: 0
  📊 Total processed: 3/3
==================================================
```

## Technical Details

- **Direct Qdrant Access**: Scripts write directly to Qdrant using the client
- **No API Server Required**: Scripts don't need the Next.js dev server running
- **Embeddings**: Uses OpenAI's `text-embedding-3-small` with 512 dimensions
- **Monitoring**: All embeddings are cached via Helicone for cost tracking
- **Error Handling**: Failed uploads are logged and counted in the summary
- **Collection Management**: Scripts automatically create collections if they don't exist

## Environment Variables Required

Make sure your `.env.local` file contains:

```env
OPENAI_API_KEY=your-openai-key
HELICONE_API_KEY=your-helicone-key
QDRANT_URL=your-qdrant-url
QDRANT_API_KEY=your-qdrant-key
```
