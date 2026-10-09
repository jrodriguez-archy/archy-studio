import type { Brand } from './brands';

// Example briefs to copy into Claude: the Docs (Make designs) and the Gallery's welcome show these.
export const EXAMPLE_BRIEFS: Record<Brand, string[]> = {
  archy: [
    'We have booth #1211 at the Chicago Midwinter Meeting, February 18 to 20 in Chicago. Make the social posts.',
    'Reminder for tomorrow: we are at the Hinman Dental Meeting in Atlanta, booth #1039.',
    'We are hosting a free night out for Dallas dentists at Topgolf Dallas, Friday October 9, 6 to 8 PM.',
    'Instagram ad introducing Sarah Thompson, our Account Executive in Austin, TX. Her photo is in Assets.',
    'Event page cover for our booth at the Greater New York Dental Meeting, booth #4402.',
  ],
  doc: [
    'DOC ad for the Startup track: enrollment is open. Give me two options.',
    'DOC Live Session on November 18 at 7 PM ET: “How do you value a practice you want?” with Jordan Ellis (Acquisition track). I have his photo.',
    'A DOC glossary post explaining what an LOI is.',
  ],
};
