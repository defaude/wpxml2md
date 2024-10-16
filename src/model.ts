export type Category = {
    text: string;
    name: string;
};

export type Post = {
    id: string;
    slug: string;
    createdAt: string; // 2024-03-17 16:31:00 (UTC)
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
