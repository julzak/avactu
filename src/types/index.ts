export type Category = "geopolitique" | "economie" | "politique";

export interface Location {
  lat: number;
  lng: number;
  name: string; // ex: "Détroit de Taïwan", "Bruxelles", "Téhéran"
}

export interface Story {
  id: string; // Format: "2026-01-24-01"
  category: Category;
  title: string; // Max 60 caractères
  imageUrl: string; // URL og:image de la source
  location: Location;
  bullets: string[]; // Exactement 5 items, max 15 mots chacun
  execSummary: string; // 200-300 mots
  sources: string[]; // ex: ["Le Monde", "The Economist"]
  publishedAt: string; // ISO date
}

export interface Edition {
  date: string; // Date de génération
  stories: Story[]; // 5-6 stories max
}
