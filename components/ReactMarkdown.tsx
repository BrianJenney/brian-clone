import remarkGfm from 'remark-gfm';
import ReactMarkdown from 'react-markdown';

export const StlyedMarkdown = ({ content = '' }: { content?: string }) => {
	return (
		<ReactMarkdown
			remarkPlugins={[remarkGfm]}
			components={{
				p: (props) => <p {...props} className='mb-2' />,
				ul: (props) => <ul {...props} className='mb-2' />,
				ol: (props) => <ol {...props} className='mb-2' />,
				li: (props) => <li {...props} className='mb-2' />,
				blockquote: (props) => (
					<blockquote {...props} className='mb-2' />
				),
				code: (props) => <code {...props} className='mb-2' />,
				pre: (props) => <pre {...props} className='mb-2' />,
				table: (props) => <table {...props} className='mb-2' />,
				tr: (props) => <tr {...props} className='mb-2' />,
				th: (props) => <th {...props} className='mb-2' />,
				td: (props) => <td {...props} className='mb-2' />,
				img: (props) => <img {...props} className='mb-2' />,
				a: (props) => <a {...props} className='mb-2' />,
				h1: (props) => <h1 {...props} className='mb-2' />,
				h2: (props) => <h2 {...props} className='mb-2' />,
				h3: (props) => <h3 {...props} className='mb-2' />,
				h4: (props) => <h4 {...props} className='mb-2' />,
				h5: (props) => <h5 {...props} className='mb-2' />,
			}}
			className='prose prose-invert prose-sm max-w-none'
		>
			{content}
		</ReactMarkdown>
	);
};
