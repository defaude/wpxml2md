export type Category = {
    text: string;
    name: string;
};

export type Post = {
    id: string;
    slug: string;
    createdAt: string; // ISO 8601 instant, e.g. 2024-03-17T16:31:00.000Z
    modifiedAt: string;
    title: string;
    content: string;
    categories: Category[];
    thumbnailId: string | undefined;

    // will be populated later
    thumbnailUrl?: string;
};

export type Attachment = {
    id: string;
    url: string;
};
