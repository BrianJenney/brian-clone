export type Author = {
  firstName: string;
  lastName: string;
  fullName: string;
};

export type Source = "article" | "post" | "linkedin" | "mixed";

export type Article = {
  id: string;
  text: string;
  author: Author;
  source: Source;
  createdAt: Date;
  metadata?: {
    topics?: string[];
    length?: number;
    [key: string]: any;
  };
};

export type ArticleUploadRequest = {
  text: string;
  authorFirstName: string;
  authorLastName: string;
  source: Source;
};

export type ArticleGenerationRequest = {
  authorName: string;
  topic?: string;
  style?: Source;
  maxLength?: number;
};

export type ArticleGenerationResponse = {
  generatedText: string;
  author: Author;
  timestamp: Date;
};
