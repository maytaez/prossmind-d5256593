export interface Expert {
    id: string;
    name: string;
    title: string;
    description: string;
    photoUrl: string;
    linkedInUrl?: string;
    priority: number;
    active: boolean;
}

export interface ExpertsData {
    title: string;
    subtitle: string;
    lastUpdated: string;
    items: Expert[];
}
