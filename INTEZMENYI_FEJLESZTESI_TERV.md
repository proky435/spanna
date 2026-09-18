# VizsgaMester – intézményi és önálló felhasználói fejlesztési terv

## 1. Dokumentum célja

A VizsgaMester jelenleg egy önálló tanulásra alkalmas PWA, statikus kérdésbankkal, felhasználói fiókkal, helyi állapottal és egyszerű szerveres szinkronizációval.

A fejlesztés célja egy olyan többfelhasználós oktatási platform kialakítása, amelyet egyaránt használhatnak:

- önálló tanulók;
- saját kérdésbankot készítő magánfelhasználók;
- oktatók;
- iskolák és képzőintézmények;
- osztályok, tanfolyamok és egyéb csoportok;
- intézményi adminisztrátorok.

A fejlesztés során a jelenlegi tanulási módokat, offline működést és felhasználói adatokat meg kell őrizni.

### Elfogadott alapdöntések

- Bármely regisztrált felhasználó létrehozhat intézményt, amelynek tulajdonosává válik.
- Kérdésbank létrehozásakor választani kell a személyes és intézményi tulajdon között.
- Az első kérdésbank-verzió támogatja az egyválaszos, többválaszos, igaz-hamis és szöveges kérdéseket.
- A szöveges válaszok automatikus vagy oktatói kézi értékelése vizsgánként állítható.
- Kérdésenként eltérő pontérték és többválaszos kérdéseknél részpontozás is használható.
- Linkes kérdésbank-megosztás közvetlenül engedélyezett, a nyilvános katalógusba kerülés moderációhoz kötött.
- Az első verzió csak szöveges tartalommal indul; képfeltöltés későbbi fejlesztés.
- Mindenki alapból normál felhasználó; az admin, oktató és diák szerepkörök intézményi vagy osztálykörnyezethez kötődnek.
- A még kézi javításra váró vizsgák előzetes eredményének láthatóságát az oktató vizsgánként állítja.
- Minden nyilvános katalógusba beküldött kérdésbankot kizárólag a platformadmin moderál, függetlenül a bank személyes vagy intézményi tulajdonától.
- A kiosztott hivatalos vizsgához internetkapcsolat szükséges, rövid kapcsolatkimaradási toleranciával.
- A fejlesztés végső ellenőrzése után a projekt tulajdonosa végzi a GitHub-feltöltést; automatikus commit és push csak külön kérésre történhet.

---

## 2. Felhasználói modellek

### 2.1. Önálló felhasználó

Az önálló felhasználó intézményi tagság nélkül is teljes értékű fiókkal rendelkezhet.

Lehetőségei:

- saját kérdésbank létrehozása;
- kézi kérdésszerkesztés;
- XLSX-, CSV- és JSON-import;
- saját gyakorlások és vizsgák összeállítása;
- saját statisztikák megtekintése;
- kérdésbank megosztása más felhasználóval;
- későbbi csatlakozás egy vagy több intézményhez;
- saját tartalmainak megtartása intézményhez csatlakozás után is.

### 2.2. Intézményi felhasználó

Egy felhasználó több intézmény tagja is lehet. Szerepköre intézményenként eltérhet.

Tervezett szerepkörök:

- platformadmin;
- intézményi tulajdonos;
- intézményi admin;
- oktató;
- diák.

A jogosultságokat nem közvetlenül a `users` táblában, hanem intézményi tagságon keresztül kell kezelni.

### 2.3. Vendég felhasználó

A vendég mód megmaradhat korlátozott, kizárólag helyi használatra.

Korlátozások:

- nincs többeszközös szinkronizáció;
- nincs intézményi csatlakozás;
- nincs szerveres saját kérdésbank;
- nincs kiosztott hivatalos vizsga;
- egyértelmű figyelmeztetés szükséges az adatvesztés lehetőségéről.

---

## 3. Intézmények, osztályok és tagságok

### 3.1. Intézmény

Egy intézmény rendelkezik:

- névvel;
- egyedi sluggal;
- logóval és arculati beállításokkal;
- tulajdonossal;
- adminisztrátorokkal;
- oktatókkal és diákokkal;
- osztályokkal vagy tanfolyamokkal;
- saját kérdésbankokkal;
- saját vizsgákkal és riportokkal;
- adatmegőrzési és eredménypublikálási alapbeállításokkal.

### 3.2. Osztály vagy kurzus

Egy intézményen belül több osztály vagy kurzus hozható létre.

Tulajdonságok:

- név;
- tanév vagy időszak;
- tantárgy;
- oktatók;
- diákok;
- aktív vagy archivált állapot;
- kapcsolódó kérdésbankok;
- kiosztott vizsgák és feladatok.

### 3.3. Beléptetési lehetőségek

Az összes kiválasztott beléptetési mód támogatandó:

1. Meghívó link
2. Emailes meghívás
3. Intézményi vagy osztálykód
4. Admin által létrehozott felhasználó
5. Később tömeges CSV/XLSX felhasználó-import

Ezeket egységes meghívórendszer kezelje.

---

## 4. Jogosultsági modell

### 4.1. Alapelvek

- Minden intézményi adat lekérdezése intézményazonosítóval legyen korlátozva.
- Minden módosító végpont szerveroldalon ellenőrizze a szerepkört.
- A frontend jogosultsági ellenőrzése csak felhasználói élmény, nem biztonsági határ.
- A felhasználó saját privát tartalma ne váljon automatikusan intézményi tulajdonná.
- Intézményből való kilépéskor meg kell különböztetni a személyes és intézményi tartalmakat.

### 4.2. Példa jogosultságok

#### Intézményi tulajdonos

- intézmény adatainak kezelése;
- adminok kezelése;
- intézmény törlésének kezdeményezése;
- későbbi előfizetési és számlázási beállítások.

#### Intézményi admin

- oktatók és diákok kezelése;
- osztályok létrehozása;
- meghívások kezelése;
- intézményi riportok megtekintése;
- intézményi kérdésbankok kezelése.

#### Oktató

- saját és engedélyezett kérdésbankok kezelése;
- kérdések importálása és szerkesztése;
- vizsgák létrehozása és kiosztása;
- saját osztályainak eredményei;
- eredmények publikálása.

#### Diák

- kiosztott tananyagok és vizsgák megtekintése;
- vizsgák kitöltése;
- engedélyezett eredmények megtekintése;
- saját tanulási statisztika.

---

## 5. Javasolt adatmodell

A végleges séma migrációs rendszerrel készüljön. A szerver indulásakor futó közvetlen `CREATE TABLE` megoldást fokozatosan adatbázis-migrációkra kell cserélni.

### 5.1. Felhasználók és intézmények

```text
users
- id
- email
- password_hash
- display_name
- email_verified_at
- created_at
- updated_at
- deleted_at

institutions
- id
- name
- slug
- logo_url
- settings JSONB
- created_by
- created_at
- updated_at
- archived_at

institution_memberships
- id
- institution_id
- user_id
- role
- status
- joined_at
- created_at

classes
- id
- institution_id
- name
- subject
- term
- created_by
- created_at
- archived_at

class_memberships
- id
- class_id
- user_id
- role
- joined_at

invitations
- id
- institution_id
- class_id
- email
- role
- token_hash
- invite_code
- max_uses
- used_count
- expires_at
- created_by
- created_at
```

### 5.2. Kérdésbankok és kérdések

```text
question_banks
- id
- owner_user_id
- institution_id nullable
- name
- description
- visibility
- status
- created_at
- updated_at
- archived_at

question_bank_access
- id
- question_bank_id
- user_id nullable
- class_id nullable
- permission
- created_at

questions
- id
- question_bank_id
- external_id
- type
- question_text
- options JSONB nullable
- correct_answer JSONB nullable
- grading_config JSONB
- explanation
- subject
- topic
- tags JSONB
- difficulty
- default_points
- media_url
- version
- status
- created_by
- created_at
- updated_at
- archived_at

question_versions
- id
- question_id
- version
- snapshot JSONB
- created_by
- created_at
```

### 5.3. Importok

```text
question_imports
- id
- question_bank_id
- file_name
- file_type
- status
- total_rows
- valid_rows
- invalid_rows
- duplicate_rows
- created_by
- created_at
- completed_at

question_import_errors
- id
- import_id
- row_number
- field
- error_code
- message
- source_data JSONB
```

### 5.4. Vizsgák és próbálkozások

```text
exam_templates
- id
- owner_user_id
- institution_id nullable
- question_bank_id
- name
- description
- question_count
- time_limit_seconds
- pass_percent
- shuffle_questions
- shuffle_options
- allow_back_navigation
- result_release_policy
- result_visibility JSONB
- created_at
- updated_at

exam_assignments
- id
- exam_template_id
- class_id
- starts_at
- due_at
- max_attempts
- status
- created_by
- published_at

exam_attempts
- id
- assignment_id nullable
- exam_template_id
- user_id
- started_at
- expires_at
- submitted_at
- status
- score
- percent
- duration_seconds
- grading_snapshot JSONB

exam_attempt_questions
- id
- attempt_id
- question_id
- question_version
- position
- question_snapshot JSONB

exam_answers
- id
- attempt_question_id
- answer JSONB
- answered_at
- grading_status
- is_correct nullable
- awarded_points nullable
- graded_by nullable
- graded_at nullable
- grader_note nullable
```

### 5.5. Tanulási állapot

A jelenlegi teljes felhasználói JSONB állapot hosszú távon külön rekordokra bontandó:

```text
question_progress
- user_id
- question_id
- seen_count
- correct_count
- wrong_count
- last_correct
- last_seen_at

bookmarks
- user_id
- question_id
- created_at

sm2_progress
- user_id
- question_id
- easiness_factor
- interval_days
- repetitions
- lapses
- next_review_at
- last_reviewed_at
```

Ez csökkenti a több eszköz közötti felülírásból eredő adatvesztés esélyét.

---

## 6. Kérdésbank-hozzáférés

Minden kérdésbankhoz külön hozzáférési mód tartozzon:

- `private`: csak a tulajdonos;
- `institution`: az intézmény engedélyezett oktatói;
- `class`: kijelölt osztályok;
- `shared`: konkrét felhasználók vagy csoportok;
- `public`: moderáció után megjelenő nyilvános katalógus.

A közvetlen linkes megosztás moderáció nélkül használható. A kereshető nyilvános katalógusba csak jóváhagyott kérdésbank kerülhet.

Támogatandó jogosultságok:

- megtekintés;
- használat saját vizsgában;
- szerkesztés;
- megosztás;
- adminisztráció.

A megosztott kérdésbank használata ne adjon automatikusan szerkesztési jogot.

---

## 7. Kérdések létrehozása és importálása

### 7.1. Kézi szerkesztő

Kezelendő mezők:

- kérdés szövege;
- 2–8 válaszlehetőség;
- egy helyes válasz;
- opcionális magyarázat;
- tantárgy;
- témakör;
- címkék;
- nehézség;
- aktív, piszkozat vagy archivált állapot.

Az első verzióban kép- és fájlcsatolás még nem része a kérdésszerkesztőnek.

### 7.2. XLSX-import

- letölthető sablon;
- több munkalap támogatása;
- oszlopok felismerése vagy hozzárendelése;
- előnézet mentés előtt;
- soronkénti hibák;
- duplikációk felismerése;
- import visszavonhatósága.

### 7.3. CSV-import

- UTF-8 támogatás;
- elválasztó automatikus felismerése;
- oszlop-hozzárendelés;
- azonos validációs motor használata, mint XLSX esetén.

### 7.4. JSON-import

- dokumentált JSON Schema;
- tömbös és egyedi kérdésimport;
- verziózott importformátum;
- technikai hibaüzenetek mellett emberileg érthető visszajelzés.

### 7.5. Egységes importfolyamat

1. Fájl fogadása
2. Formátum felismerése
3. Normalizálás közös belső struktúrára
4. Validáció
5. Duplikációvizsgálat
6. Előnézet
7. Oktatói jóváhagyás
8. Tranzakciós mentés
9. Importnapló

---

## 8. Vizsgák

### 8.1. Saját vizsga

Önálló felhasználó vagy oktató saját gyakorlási célra készíthet vizsgát.

Beállítások:

- kérdésbank;
- kérdésszám;
- időlimit;
- témakörszűrés;
- kérdés- és válaszsorrend keverése;
- minimum teljesítési százalék;
- azonnali vagy vizsga végi kiértékelés;
- szöveges válaszok automatikus vagy kézi javítása;
- kérdésenként eltérő pontérték;
- többválaszos kérdések részpontozási szabálya.

### 8.2. Kiosztott intézményi vizsga

Az oktató osztályhoz vagy konkrét diákokhoz rendelheti.

Beállítások:

- kezdési idő;
- határidő;
- időlimit;
- maximális próbálkozások;
- visszanavigálás engedélyezése;
- automatikus beadás;
- eredmény láthatósága;
- kérdések és válaszok keverése;
- teljesítési küszöb.

### 8.3. Eredménypublikálási szabályok

Minden szükséges változat támogatandó:

- `immediate`: azonnali teljes eredmény;
- `after_deadline`: teljes eredmény a határidő után;
- `manual`: oktató által publikálva;
- `score_only`: csak pontszám és százalék;
- `hidden`: eredmény nem látható a diáknak.

Kézi javítást tartalmazó vizsgánál az oktató külön beállíthatja, hogy a diák lássa-e az automatikusan javított rész előzetes, még nem végleges eredményét.

Külön kapcsolók:

- pontszám látható;
- hibás kérdések láthatók;
- helyes válaszok láthatók;
- magyarázatok láthatók;
- osztályátlag látható.

### 8.4. Hivatalos vizsgák biztonsága

- A szerver hozza létre a próbálkozást.
- A szerver rögzíti a kezdési és lejárati időt.
- A szerver választja ki és rögzíti a kérdéseket.
- A kliens ne kapja meg előre a helyes válaszokat.
- A válaszok folyamatosan mentődjenek.
- A szerver számítsa ki a végeredményt.
- Lejárt vizsga ne legyen folytatható.
- Minden fontos művelet kerüljön auditnaplóba.

A most elkészült 40 kérdéses, 40 perces Éles vizsga mód önálló gyakorlási funkcióként használható. Intézményi vizsgához később szerveroldali próbálkozáskezelés szükséges.

---

## 9. Oktatói és adminisztrátori felületek

### 9.1. Oktatói dashboard

- saját osztályok;
- aktív kérdésbankok;
- közelgő vizsgák;
- beadási arány;
- átlagos eredmény;
- legnehezebb kérdések;
- gyenge témakörök;
- legutóbbi aktivitás.

### 9.2. Kérdésbank-kezelő

- bankok listája;
- keresés és szűrés;
- kézi szerkesztő;
- import;
- másolás;
- archiválás;
- verzióelőzmény;
- megosztási beállítások.

### 9.3. Vizsgaszerkesztő

- kérdésbank kiválasztása;
- kérdésszám és szűrők;
- időlimit;
- célcsoport;
- időablak;
- próbálkozások;
- eredménypublikálási szabály;
- előnézet;
- publikálás.

### 9.4. Adminfelület

- intézményi profil;
- felhasználók és szerepkörök;
- meghívások;
- osztályok;
- kérdésbank-hozzáférések;
- auditnapló;
- adatmegőrzési beállítások.

---

## 10. Statisztikák és riportok

### 10.1. Diák

- saját vizsgatörténet;
- témakörönkénti teljesítmény;
- fejlődési grafikon;
- átlagos kitöltési idő;
- hibás és nehéz kérdések;
- esedékes ismétlések.

### 10.2. Oktató

- vizsgánkénti eredmények;
- diákonkénti eredmények;
- osztályátlag és medián;
- teljesítési arány;
- kérdésenkénti helyes válaszarány;
- témakörönkénti bontás;
- megválaszolatlan kérdések;
- átlagos kitöltési idő;
- CSV-export;
- később PDF-export.

### 10.3. Intézményi admin

- intézményi aktivitás;
- aktív oktatók és diákok;
- osztályok összehasonlítása;
- kérdésbank-használat;
- vizsgák teljesítési mutatói;
- adat- és auditriportok.

---

## 11. API-terv

Példa végpontcsoportok:

```text
/api/auth/*
/api/users/*
/api/institutions/*
/api/institutions/:id/members/*
/api/classes/*
/api/invitations/*
/api/question-banks/*
/api/questions/*
/api/imports/*
/api/exam-templates/*
/api/exam-assignments/*
/api/exam-attempts/*
/api/reports/*
```

Minden végpontnál szükséges:

- auth middleware;
- szerepkör- és jogosultságvizsgálat;
- intézményi hatókör ellenőrzése;
- bemeneti séma validálása;
- egységes hibaválasz;
- auditálható módosítások.

---

## 12. Frontend navigációs terv

### Önálló felhasználó

- Kezdőlap
- Tanulás
- Saját kérdésbankok
- Saját vizsgák
- Statisztika
- Profil

### Diák intézményi tagsággal

- Kezdőlap
- Tanulás
- Feladataim és vizsgáim
- Eredményeim
- Intézményeim
- Profil

### Oktató

- Dashboard
- Kérdésbankok
- Vizsgák
- Osztályok
- Riportok
- Profil

### Admin

- Dashboard
- Felhasználók
- Osztályok
- Jogosultságok
- Intézményi beállítások
- Auditnapló

A felhasználó az aktív intézményt fejlécből választhassa ki. A „Saját tér” külön kontextusként maradjon elérhető.

---

## 13. Biztonsági feladatok

A következőket az intézményi funkciók előtt kell megoldani:

1. A korábban megosztott JWT secret rotálása.
2. Hardcoded production JWT fallback eltávolítása.
3. Login- és regisztrációs rate limit.
4. Helmet és biztonsági HTTP headerek.
5. Szerveroldali inputvalidáció.
6. Erősebb jelszószabályok.
7. Email-verifikáció.
8. Elfelejtett jelszó és tokenlejárat.
9. Rövid életű access token és refresh token, lehetőleg HttpOnly cookie-val.
10. Fájlfeltöltések típus- és méretkorlátozása.
11. Kártékony fájlok és képek ellenőrzése.
12. Auditnapló admin- és oktatói műveletekhez.
13. Intézményi adatok szigorú szerveroldali elkülönítése.
14. Adatbázis-backup és visszaállítási eljárás.

---

## 14. Adatvédelem és üzemeltetés

- GDPR-kompatibilis adatkezelési tájékoztató;
- felhasználói adatexport;
- fióktörlés és anonimizálás;
- intézményi adatmegőrzési szabályok;
- naplómegőrzési idő;
- adatbázis-backup;
- staging és production környezet;
- központi hibajelentés és monitorozás;
- automatikus tesztek és CI;
- adatbázis-migrációk verziózása.

Kiskorú felhasználók esetén külön meg kell vizsgálni a szülői hozzájárulást, az intézményi adatkezelői szerepet és az életkorhoz kapcsolódó szabályokat.

---

## 15. Megvalósítási szakaszok

### Szakasz 0 – Előkészítés és döntések

- termékdöntések véglegesítése;
- szerepkörmátrix;
- kérdésimport-sablon;
- eredménypublikálási szabályok;
- adatmegőrzési szabályok;
- UI-vázlatok.

### Szakasz 1 – Biztonság és adatbázis-alapok

- JWT és auth megerősítése;
- rate limit és Helmet;
- inputvalidáció;
- migrációs rendszer;
- fejlesztői, staging és production konfiguráció elkülönítése;
- automatizált backend tesztalap.

### Szakasz 2 – Önálló kérdésbankok

- kérdésbank- és kérdéstáblák;
- privát tulajdonlás;
- kézi kérdésszerkesztő;
- XLSX-, CSV- és JSON-import;
- előnézet, validáció és importnapló;
- jelenlegi statikus kérdések migrálása rendszer-kérdésbankba.

### Szakasz 3 – Intézmények és jogosultságok

- intézmény létrehozása;
- tagságok és szerepkörök;
- osztályok;
- meghívó link, email, kód és admin általi felvitel;
- vegyes kérdésbank-hozzáférés;
- aktív intézmény kiválasztása.

### Szakasz 4 – Kiosztott vizsgák

- vizsgasablonok;
- osztályhoz és diákhoz rendelés;
- szerveroldali próbálkozások;
- szerveroldali időlimit és kiértékelés;
- automatikus válaszmentés;
- eredménypublikálási módok;
- megszakadt kapcsolat kezelése.

### Szakasz 5 – Dashboard és riportok

- oktatói dashboard;
- osztály- és diákriportok;
- kérdésanalitika;
- CSV-export;
- eredménypublikálás;
- admin dashboard és auditnézet.

### Szakasz 6 – Stabilizálás és skálázás

- terheléses tesztek;
- monitoring;
- backup és visszaállítás próbája;
- GDPR-folyamatok;
- teljesítményoptimalizálás;
- PWA offline stratégia felülvizsgálata;
- dokumentáció és intézményi onboarding.

---

## 16. Tesztelési stratégia

### Backend

- auth és jogosultság unit tesztek;
- intézményi adatszigetelés integrációs tesztek;
- import validációs tesztek;
- vizsga időlimit és beadás tesztek;
- eredménypublikálási szabályok tesztjei;
- konkurens válaszmentés tesztjei.

### Frontend

- szerepkörfüggő navigáció;
- kérdésszerkesztő;
- import-előnézet;
- vizsgakitöltés;
- offline és kapcsolat-visszaállási folyamat;
- mobil és asztali nézet.

### End-to-end

- intézmény létrehozása;
- oktató meghívása;
- osztály létrehozása;
- diák csatlakozása;
- kérdésbank importálása;
- vizsga kiosztása;
- diák kitöltése;
- eredmény publikálása;
- riport exportálása.

---

## 17. Migráció a jelenlegi rendszerből

1. A meglévő `users` rekordok megmaradnak.
2. Minden jelenlegi felhasználó önálló felhasználóként indul.
3. A `questions.json` tartalma egy rendszer által kezelt, csak olvasható kérdésbankba kerül.
4. A jelenlegi progress, bookmark, wrong és SM-2 adatok fokozatosan külön táblákba migrálódnak.
5. A régi JSONB state ideiglenesen kompatibilitási forrás marad.
6. A migráció után ellenőrzött háttérfolyamat vezeti át a felhasználói adatokat.
7. Visszaállítási lehetőség szükséges minden adatbázis-migráció előtt.

---

## 18. Kifejezetten nem javasolt megoldások

- Intézményi azonosító puszta frontend-paraméterként, szerveroldali ellenőrzés nélkül.
- Hivatalos vizsga kiértékelése kizárólag a böngészőben.
- Helyes válaszok előzetes letöltése hivatalos vizsgánál.
- Teljes intézményi állapot tárolása egyetlen JSONB mezőben.
- Kérdésbankok frissítése kizárólag új frontend deployjal.
- Jogosultságkezelés csak elrejtett frontend gombokkal.
- Fájlfeltöltés validáció és méretkorlát nélkül.
- Kérdések végleges törlése verziózás vagy archiválás nélkül.

---

## 19. Átbeszélendő döntések implementáció előtt

1. Bárki létrehozhat-e intézményt, vagy ehhez platformadmin-jóváhagyás kell?
2. Egy oktató lehet-e egyszerre több intézmény tagja?
3. Az önálló felhasználó megoszthatja-e kérdésbankját nyilvánosan?
4. Az intézményi kérdésbank tulajdonosa az oktató vagy az intézmény legyen?
5. Intézményből távozó oktató megtarthatja-e az általa készített kérdéseket?
6. Az emailes meghívást melyik szolgáltató küldje?
7. Kell-e képfeltöltés már az első kérdésbank-verzióban?
8. Egy kérdésnek lehet-e több helyes válasza?
9. Kell-e esszé/szöveges válasz, vagy csak feleletválasztós kérdés?
10. Kell-e részpontszám vagy eltérő kérdéspontszám?
11. Hivatalos vizsga működhet-e offline?
12. Kell-e vizsgafelügyeleti funkció, például fókuszvesztés naplózása?
13. Mennyi ideig őrizzük meg a vizsgaeredményeket és auditnaplókat?
14. Kell-e magyar mellett más nyelv?
15. Mely funkciók legyenek ingyenesek és melyek intézményi/prémium funkciók?

---

## 20. Első javasolt fejlesztési csomag

Az első implementációs csomag ne a teljes intézményi rendszert próbálja egyszerre elkészíteni. Javasolt első csomag:

1. Biztonsági alapok és adatbázis-migrációk
2. Önálló felhasználói kérdésbankok
3. Kézi kérdésszerkesztő
4. XLSX-, CSV- és JSON-import közös validációs motorral
5. Jelenlegi kérdések rendszer-kérdésbankba migrálása
6. Kérdésbank-alapú tanulási és vizsgamódok

Ez a csomag az elfogadott kezdő fejlesztési irány. Az intézményi funkciókat csak a biztonságos, migrálható kérdésbank-alap elkészülte után kell ráépíteni.

Erre stabilan ráépíthető az intézményi tagság, az osztálykezelés és a kiosztott vizsgák rendszere.
