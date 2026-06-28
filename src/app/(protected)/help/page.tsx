import { readFile } from "fs/promises";
import path from "path";
import HelpTabs from "./HelpTabs";

export const dynamic = "force-dynamic";

async function readDoc(filename: string): Promise<string> {
  try {
    return await readFile(path.join(process.cwd(), "docs", filename), "utf-8");
  } catch {
    return `# Nicht gefunden\n\nDie Datei \`${filename}\` konnte nicht geladen werden.`;
  }
}

export default async function HelpPage() {
  const [benutzer, admin, installation] = await Promise.all([
    readDoc("BENUTZERHANDBUCH.md"),
    readDoc("ADMIN-HANDBUCH.md"),
    readDoc("INSTALLATION.md"),
  ]);

  const docs = [
    { id: "benutzer",     label: "Benutzerhandbuch",    content: benutzer },
    { id: "admin",        label: "Administrator",        content: admin },
    { id: "installation", label: "Installation",         content: installation },
  ];

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-6">Hilfe & Dokumentation</h1>
      <HelpTabs docs={docs} />
    </div>
  );
}
