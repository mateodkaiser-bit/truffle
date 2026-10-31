// Who was there: remembered per device, like Spotmapper remembered the last names used.
const LAST_PEOPLE_KEY = "crm:last-people";

export function lastPeople(): string[] {
  try {
    return JSON.parse(localStorage.getItem(LAST_PEOPLE_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function rememberPeople(people: string[]) {
  try {
    localStorage.setItem(LAST_PEOPLE_KEY, JSON.stringify(people));
  } catch {
    // Private mode: the chips just start empty next time.
  }
}
