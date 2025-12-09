export interface Partner {
    id: string;
    name: string;
    role: string;
    type: 'partner' | 'advisor';
    logoUrl: string;
    websiteUrl: string;
    priority: number;
    active: boolean;
}

export interface PartnersData {
    title: string;
    subtitle: string;
    lastUpdated: string;
    items: Partner[];
}
