import { getSuggestions } from "@/lib/db/suggestions";
import { SuggestionsClient } from "./_components/SuggestionsClient";

export default async function SuggestionsPage() {
  const suggestions = await getSuggestions();
  return <SuggestionsClient initialData={suggestions} />;
}
