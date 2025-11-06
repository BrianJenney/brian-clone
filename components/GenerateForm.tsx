'use client';

import { useState } from 'react';
import { ArticleGenerationRequest } from '@/libs/types';

export default function GenerateForm() {
  const [formData, setFormData] = useState<ArticleGenerationRequest>({
    authorName: '',
    topic: '',
    style: 'mixed',
    maxLength: 1000,
  });
  const [loading, setLoading] = useState(false);
  const [generatedText, setGeneratedText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setGeneratedText('');

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setGeneratedText(data.generatedText);
      } else {
        setError(data.error || 'Failed to generate article');
      }
    } catch (error) {
      setError('An error occurred while generating the article');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedText);
    alert('Copied to clipboard!');
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="authorName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Author Name (First Last)
          </label>
          <input
            type="text"
            id="authorName"
            value={formData.authorName}
            onChange={(e) => setFormData({ ...formData, authorName: e.target.value })}
            required
            placeholder="John Doe"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>

        <div>
          <label htmlFor="topic" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Topic (Optional)
          </label>
          <input
            type="text"
            id="topic"
            value={formData.topic}
            onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
            placeholder="e.g., AI in healthcare, remote work trends..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>

        <div>
          <label htmlFor="style" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Style
          </label>
          <select
            id="style"
            value={formData.style}
            onChange={(e) => setFormData({ ...formData, style: e.target.value as 'article' | 'linkedin' | 'mixed' })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="mixed">Mixed (Article + LinkedIn)</option>
            <option value="article">Article Only</option>
            <option value="linkedin">LinkedIn Only</option>
          </select>
        </div>

        <div>
          <label htmlFor="maxLength" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Max Length (characters)
          </label>
          <input
            type="number"
            id="maxLength"
            value={formData.maxLength}
            onChange={(e) => setFormData({ ...formData, maxLength: parseInt(e.target.value) })}
            min={100}
            max={5000}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-md transition-colors"
        >
          {loading ? 'Generating...' : 'Generate Article'}
        </button>
      </form>

      {error && (
        <div className="p-4 rounded-md bg-red-50 text-red-800 dark:bg-red-900 dark:text-red-200">
          {error}
        </div>
      )}

      {generatedText && (
        <div className="mt-6 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Generated Article</h3>
            <button
              onClick={copyToClipboard}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-md transition-colors"
            >
              Copy to Clipboard
            </button>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700">
            <p className="whitespace-pre-wrap text-gray-800 dark:text-gray-200">{generatedText}</p>
          </div>
        </div>
      )}
    </div>
  );
}
