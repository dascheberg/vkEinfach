export type DefaultAccount = {
  number: number;
  name: string;
  accountKind: "income" | "expense" | "neutral" | "transfer" | "cancel";
};

export const DEFAULT_INTERNAL_ACCOUNTS: DefaultAccount[] = [
  { number: 100, name: "Übertrag Vorjahr Konto",   accountKind: "neutral"  },
  { number: 101, name: "Bargeld",                   accountKind: "neutral"  },
  { number: 102, name: "Beitrag Vorjahre",          accountKind: "income"   },
  { number: 103, name: "Beitrag lfd. Jahr",         accountKind: "income"   },
  { number: 104, name: "Beitrag nächstes Jahr",     accountKind: "income"   },
  { number: 105, name: "Rechnungsabgrenzung",       accountKind: "neutral"  },
  { number: 106, name: "Getränke/Wurst",            accountKind: "income"   },
  { number: 107, name: "Verkauf",                   accountKind: "income"   },
  { number: 108, name: "Sonstige Einnahmen",        accountKind: "income"   },
  { number: 109, name: "Spenden (E)",               accountKind: "income"   },
  { number: 110, name: "Zuschuss Gemeinde",         accountKind: "income"   },
  { number: 120, name: "Zuschuss Dritte",           accountKind: "income"   },
  { number: 130, name: "Essen Februar",             accountKind: "expense"  },
  { number: 140, name: "Ausfahrt 1",                accountKind: "expense"  },
  { number: 150, name: "Ausfahrt 2",                accountKind: "expense"  },
  { number: 160, name: "Reise 1 Eigenanteil",       accountKind: "income"   },
  { number: 170, name: "Reise 2 Eigenanteil",       accountKind: "income"   },
  { number: 180, name: "Reise 1 Sonstige",          accountKind: "neutral"  },
  { number: 190, name: "Reise 2 Sonstige",          accountKind: "neutral"  },
  { number: 199, name: "SoPo 1",                    accountKind: "neutral"  },
  { number: 200, name: "Kaffeenachmittag",          accountKind: "expense"  },
  { number: 201, name: "Geburtstag/Jubiläum",       accountKind: "expense"  },
  { number: 202, name: "Beerdigung",                accountKind: "expense"  },
  { number: 203, name: "Sonstige Ausgaben",         accountKind: "expense"  },
  { number: 204, name: "Spenden (A)",               accountKind: "expense"  },
  { number: 205, name: "Ehrungen",                  accountKind: "expense"  },
  { number: 210, name: "MTA Müritz",                accountKind: "expense"  },
  { number: 220, name: "Grillfest",                 accountKind: "expense"  },
  { number: 230, name: "Kinonachmittag",            accountKind: "expense"  },
  { number: 240, name: "Essen 25.01.2025",          accountKind: "expense"  },
  { number: 500, name: "Durchlaufende Posten",      accountKind: "transfer" },
  { number: 600, name: "Kontoführungsgebühren",     accountKind: "expense"  },
  { number: 800, name: "Kassendifferenzen",         accountKind: "neutral"  },
  { number: 997, name: "Umbuchung Spar/Konto",      accountKind: "transfer" },
  { number: 998, name: "Umbuchung Konto/Bar",       accountKind: "transfer" },
  { number: 999, name: "Storno",                    accountKind: "cancel"   },
];
