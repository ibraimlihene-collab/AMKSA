export type Language = 'ar' | 'en' | 'fr';
const copy = {
  title: ['أمكسا — رحلة الراعي', 'Amksa — The Shepherd’s Journey', 'Amksa — Le voyage du berger'],
  subtitle: ['اتبع الأثر، افهم الآلة، وأعد القطيع إلى المأوى.', 'Follow the trail, understand the mechanism, bring the flock to safety.', 'Suivez les traces, comprenez les mécanismes et abritez le troupeau.'],
  language: ['اللغة', 'Language', 'Langue'], start: ['ابدأ الرحلة', 'Start journey', 'Commencer'], resume: ['استئناف', 'Continue', 'Continuer'],
  chapters: ['الفصول التي وصلت إليها', 'Visited chapters', 'Chapitres visités'], settings: ['الإعدادات والتحكم', 'Settings and controls', 'Réglages et commandes'],
  music: ['الموسيقى', 'Music', 'Musique'], sfx: ['المؤثرات', 'Sound effects', 'Effets sonores'],
  motion: ['تقليل الحركة', 'Reduce motion', 'Réduire les animations'], challenge: ['وضع التحدّي: ثلاث وفيات منذ آخر نقطة حفظ تعيد العالم', 'Challenge: three deaths since a checkpoint restart the world', 'Défi : trois morts depuis un point de contrôle recommencent le monde'],
  large: ['تكبير النص', 'Larger text', 'Agrandir le texte'], pause: ['إيقاف مؤقت', 'Pause', 'Pause'], paused: ['اللعبة متوقفة', 'Game paused', 'Jeu en pause'],
  reset: ['إعادة موارد الغرفة', 'Restore room resources', 'Rétablir les ressources'], menu: ['حفظ والعودة للقائمة', 'Save and return to menu', 'Enregistrer et revenir au menu'],
  policy: ['يُحفظ الإنقاذ والألغاز والأبواب والعملات. تستأنف عند آخر نقطة حفظ، وتعود الموارد إلى مواضع آمنة.', 'Rescues, puzzles, gates and coins persist. Continue at the checkpoint with resources restored to safe positions.', 'Sauvetages, énigmes, portes et pièces persistent. Reprenez au point de contrôle avec les ressources rétablies.'],
  erase: ['بدء رحلة جديدة يمحو التقدم المحفوظ. هل تريد المتابعة؟', 'A new journey erases saved progress. Continue?', 'Un nouveau voyage efface la progression. Continuer ?'],
  cancel: ['إلغاء', 'Cancel', 'Annuler'], confirm: ['تأكيد', 'Confirm', 'Confirmer'], next: ['التالي', 'Next', 'Suivant'], skip: ['تخطي المقدمة', 'Skip introduction', 'Passer l’introduction'], replay: ['إعادة المقدمة', 'Replay introduction', 'Revoir l’introduction'],
  saveRecovered: ['استُعيد حفظ متوافق. ستستأنف من نقطة الحفظ.', 'A compatible save was recovered. Continue at the checkpoint.', 'Une sauvegarde compatible a été récupérée. Reprenez au point de contrôle.'],
  saveFailed: ['تعذر الحفظ. صدّر تقدمك قبل الإغلاق.', 'Cannot save. Export progress before closing.', 'Enregistrement impossible. Exportez votre progression avant de fermer.'],
  eraseFailed: ['تعذر محو الحفظ.', 'Cannot erase the save.', 'Impossible d’effacer la sauvegarde.'],
  importFailed: ['ملف الحفظ غير صالح؛ احتُفظ بتقدمك الحالي.', 'Invalid save file. Current progress was preserved.', 'Fichier invalide. Votre progression actuelle est conservée.'],
  imported: ['تم استيراد التقدم.', 'Progress imported.', 'Progression importée.'],
  export: ['تصدير الحفظ', 'Export save', 'Exporter la sauvegarde'], import: ['استيراد الحفظ', 'Import save', 'Importer la sauvegarde'],
  health: ['الصحة', 'Health', 'Santé'], sheep: ['الأغنام المنقذة', 'Sheep rescued', 'Moutons sauvés'], puzzles: ['الألغاز', 'Puzzles', 'Énigmes'], coins: ['العملات', 'Coins', 'Pièces'], deaths: ['الوفيات', 'Deaths', 'Morts'],
  all: ['عاد القطيع كله إلى المأوى.', 'The whole flock reached safety.', 'Tout le troupeau est à l’abri.'],
  some: ['أنقذت جزءاً من القطيع. بقيت أغنام تنتظر عودتك.', 'You rescued part of the flock. Other sheep still need you.', 'Vous avez sauvé une partie du troupeau. D’autres moutons vous attendent.'],
  none: ['وصلت إلى نهاية الطريق، لكن القطيع لم يُنقذ بعد.', 'You reached the end of the trail. The flock still needs rescue.', 'Vous avez atteint la fin du chemin. Le troupeau attend encore du secours.'],
  finish: ['نتيجة الرحلة', 'Journey result', 'Bilan du voyage'], resetTitle: ['انتهت محاولة التحدّي', 'Challenge attempt ended', 'Fin de la tentative du défi'],
  left: ['يسار', 'Left', 'Gauche'], right: ['يمين', 'Right', 'Droite'], jump: ['قفز', 'Jump', 'Sauter'], interact: ['تفاعل / التقط', 'Interact / collect', 'Interagir / ramasser'],
  aim: ['شحن الرمية', 'Charge throw', 'Charger le lancer'], quick: ['رمي سريع', 'Quick throw', 'Lancer rapide'], dash: ['اندفاع', 'Dash', 'Ruée'], punch: ['دفاع', 'Defend', 'Se défendre'], up: ['تصويب لأعلى', 'Aim up', 'Viser plus haut'], down: ['تصويب لأسفل', 'Aim down', 'Viser plus bas'],
  controls: ['لوحة المفاتيح أو أزرار اللمس أو يد اللعب. Escape للإيقاف. يتحكم السهمان الرأسيان بالتصويب فقط.', 'Use keyboard, touch controls or gamepad. Escape pauses. Vertical arrows only adjust aim.', 'Clavier, commandes tactiles ou manette. Échap met en pause. Les flèches verticales règlent uniquement la visée.'],
  rockCache: ['قرب كل آلة مخزون أحجار متجدد: اضغط التفاعل عندما ينفد مخزونك.', 'Each mechanism has renewable stones. Interact nearby when your inventory is empty.', 'Chaque mécanisme dispose de pierres renouvelables. Interagissez à proximité quand votre réserve est vide.'],
  puzzle: ['لوحة الآلة', 'Mechanism panel', 'Panneau du mécanisme'], clue: ['الدليل', 'Clue', 'Indice'], hint: ['مساعدة', 'Help', 'Aide'], back: ['رجوع', 'Back', 'Retour'], wrong: ['لم تتوازن الآلة بعد. قارن اختيارك بالدليل وجرّب مجدداً.', 'The mechanism is not balanced. Compare your choice with the clue and try again.', 'Le mécanisme reste déséquilibré. Comparez votre choix avec l’indice et réessayez.'],
  count: ['الأكوام الظاهرة هي الدليل. يمكن تحديد كل كومة أثناء العدّ.', 'The visible piles are the clue. Mark each pile as you count.', 'Les tas visibles sont l’indice. Marquez chaque tas pendant le comptage.'],
  sequenceWrong: ['الترتيب غير صحيح؛ ابدأ من العلامة الأولى.', 'Wrong order. Start at the first mark.', 'Ordre incorrect. Recommencez à la première marque.'],
  targetHint: ['الحبل يصل الهدف بالجسر. أصب المسمار بحجر.', 'The rope connects the target to the bridge. Hit the pin with a stone.', 'La corde relie la cible au pont. Touchez la cheville avec une pierre.'],
  plateHint: ['ضع وزناً على الصفيحة؛ لاحظ أثره على الآلة.', 'Place weight on the plate. Watch the mechanism.', 'Placez un poids sur la plaque. Observez le mécanisme.'],
  sequenceHint: ['العلامة التالية', 'Next mark', 'Marque suivante'], avalanche: ['انهيار قادم: اتبع المسار إلى الملاجئ الصخرية.', 'Avalanche approaching. Follow the path to the rock shelters.', 'Avalanche imminente. Suivez le chemin vers les abris rocheux.'],
  progress: ['التقدم', 'Progress', 'Progression'], exit: ['المخرج', 'Exit', 'Sortie'],
  cedar: ['غابة الأرز', 'Cedar forest', 'Cédraie'], pasture: ['المرعى', 'Pasture', 'Pâturage'], gorge: ['مجرى أم الربيع', 'Oum Er-Rbia watercourse', 'Cours de l’Oum Er-Rbia'], snow: ['الممر الثلجي', 'Snow passage', 'Passage enneigé'],
} satisfies Record<string, [string, string, string]>;
export const text = (lang: Language | null, key: string) => (copy as Record<string, string[]>)[key]?.[lang === 'en' ? 1 : lang === 'fr' ? 2 : 0] ?? key;

const puzzleText: Record<number, { en: string[]; fr: string[] }> = {
  1: { en: ['Complete the repeated pair on the stone.', 'Nearby carving: ⴰ ⴱ | ⴰ ⴱ | ⴰ ? — the same pair repeats.', 'Compare each pair in the carving.'], fr: ['Complétez la paire répétée sur la pierre.', 'Gravure : ⴰ ⴱ | ⴰ ⴱ | ⴰ ? — la même paire se répète.', 'Comparez les paires de la gravure.'] },
  2: { en: ['How many stone piles are visible?', 'Mark each separate pile while counting.', 'Count piles, not individual stones.'], fr: ['Combien de tas de pierres voyez-vous ?', 'Marquez chaque tas pendant le comptage.', 'Comptez les tas, pas les pierres.'] },
  3: { en: ['Three equal weights balance 9 stones. What is one weight?', 'Three identical weights balance nine unit stones.', 'Share nine equally between three weights.'], fr: ['Trois poids identiques équilibrent 9 pierres. Que vaut un poids ?', 'Trois poids identiques équilibrent neuf pierres.', 'Répartissez neuf entre trois poids identiques.'] },
  4: { en: ['Complete the stepping-stone pattern: 1, 4, 9, 16, ?', 'The diagram shows squares with sides 1, 2, 3 and 4.', 'Add one row and one column to the last square.'], fr: ['Complétez les dalles : 1, 4, 9, 16, ?', 'Le dessin montre des carrés de côtés 1, 2, 3 et 4.', 'Ajoutez une ligne et une colonne au dernier carré.'] },
  5: { en: ['Which shape differs from the other three?', 'Three marks have the same shape. One differs.', 'Compare the shapes. No alphabet knowledge is required.'], fr: ['Quelle forme diffère des trois autres ?', 'Trois signes ont la même forme. Un signe diffère.', 'Comparez les formes. Aucune connaissance de l’alphabet n’est nécessaire.'] },
  6: { en: ['Each large weight balances 2 stones. How many balance 8 stones?', 'One large weight = two small stones.', 'Group the eight stones into pairs.'], fr: ['Chaque grand poids équilibre 2 pierres. Combien pour 8 pierres ?', 'Un grand poids = deux petites pierres.', 'Regroupez les huit pierres par paires.'] },
};
export function puzzleCopy(id: number, lang: Language | null, fallback: { prompt: string; clue?: string; hint?: string }) {
  if (lang === 'en' || lang === 'fr') { const a = puzzleText[id][lang]; return { prompt: a[0], clue: a[1], hint: a[2] }; }
  return fallback;
}
export function digits(value: string, lang: Language | null) { return lang === 'ar' || !lang ? value : value.replace(/[٠-٩]/g, n => String('٠١٢٣٤٥٦٧٨٩'.indexOf(n))); }
