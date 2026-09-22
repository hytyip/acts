/* Book of Acts — narrative timeline data
   Each entry is a stop on the gospel's advance from Jerusalem
   ("to the Jew first") out to the Gentile nations (Acts 1:8).
   Coordinates are approximate real-world lat/lon for the ancient site. */

const EVENTS = [
  {
    place: "Jerusalem",
    subtitle: "Pentecost — The Church Is Born",
    verse: "Acts 1:8; 2:1–41",
    text: "The Holy Spirit falls on the disciples at Pentecost. Peter preaches to Jews \"from every nation under heaven\" gathered in Jerusalem, and about 3,000 respond. The gospel's first hearers are entirely Jewish.",
    lat: 31.7683, lon: 35.2137,
    category: "jewish",
    growth: "huge",
    believers: "≈ 3,000"
  },
  {
    place: "Jerusalem",
    subtitle: "The Church Multiplies, Then Scatters",
    verse: "Acts 4:4; 6:8–8:1",
    text: "The Jerusalem church grows to over 5,000. But Stephen is martyred and \"a great persecution\" breaks out. Believers are scattered across Judea and Samaria — the first push outward beyond the holy city.",
    lat: 31.7683, lon: 35.2137,
    category: "jewish",
    growth: "huge",
    believers: "≈ 5,000+"
  },
  {
    place: "Samaria",
    subtitle: "Philip Crosses the First Barrier",
    verse: "Acts 8:4–25",
    text: "Philip preaches Christ to the Samaritans — a people of mixed Jewish ancestry despised by observant Jews. Crowds believe and are baptized. It is the gospel's first step across an ethnic and religious dividing line.",
    lat: 32.2775, lon: 35.1972,
    category: "transition",
    growth: "large",
    believers: "\"the crowds\""
  },
  {
    place: "Gaza Road",
    subtitle: "The Ethiopian Official",
    verse: "Acts 8:26–39",
    text: "Philip is sent to a desert road, where he meets a court official of the Ethiopian queen — a God-fearing outsider reading Isaiah. He believes and is baptized, carrying the gospel toward Africa.",
    lat: 31.5017, lon: 34.4668,
    category: "transition",
    growth: "small",
    believers: "1 household"
  },
  {
    place: "Damascus",
    subtitle: "Saul Is Confronted by Christ",
    verse: "Acts 9:1–19",
    text: "Saul of Tarsus, a zealous persecutor of the church, is struck down by a vision of the risen Jesus on the road to Damascus. He will become Paul, the apostle whose name becomes synonymous with taking the gospel to the Gentiles.",
    lat: 33.5138, lon: 36.2765,
    category: "jewish",
    growth: "medium",
    believers: "1 — pivotal"
  },
  {
    place: "Caesarea",
    subtitle: "Cornelius — The Turning Point",
    verse: "Acts 10:1–11:18",
    text: "Peter is sent to Cornelius, a Roman centurion. As Peter preaches, the Holy Spirit falls on Cornelius's entire Gentile household — uncircumcised, with no prior link to Judaism. The Jerusalem church concludes: \"God has granted repentance that leads to life even to the Gentiles.\"",
    lat: 32.5000, lon: 34.9000,
    category: "gentile",
    growth: "large",
    believers: "a household"
  },
  {
    place: "Antioch",
    subtitle: "Where Believers Are First Called \"Christians\"",
    verse: "Acts 11:19–26",
    text: "Scattered believers preach to Greeks in Antioch, and \"a great number\" believe. Barnabas and Saul teach there for a year. Antioch becomes a thriving Jewish-and-Gentile church — and the base from which the mission to the nations will be launched.",
    lat: 36.2021, lon: 36.1603,
    category: "gentile",
    growth: "huge",
    believers: "\"a great number\""
  },
  {
    place: "Pisidian Antioch",
    subtitle: "\"We Turn to the Gentiles\"",
    verse: "Acts 13:1–14:28",
    text: "Sent out from Antioch, Paul and Barnabas sail to Cyprus, then cross into Asia Minor — Pisidian Antioch, Iconium, Lystra, Derbe. When many Jews reject the message, Paul declares: \"We now turn to the Gentiles.\" Gentile crowds respond with joy.",
    lat: 38.3095, lon: 31.1954,
    category: "gentile",
    growth: "large",
    believers: "many towns"
  },
  {
    place: "Jerusalem",
    subtitle: "The Council Settles the Question",
    verse: "Acts 15:1–35",
    text: "Leaders gather in Jerusalem to decide whether Gentile converts must keep the Law of Moses. The council rules they need not — salvation is by grace, for Jew and Gentile alike. The theological door is now officially open.",
    lat: 31.7683, lon: 35.2137,
    category: "gentile",
    growth: "small",
    believers: "a decision for all"
  },
  {
    place: "Philippi",
    subtitle: "The Gospel Reaches Europe",
    verse: "Acts 16:6–40",
    text: "Guided by a vision (\"Come over to Macedonia and help us\"), Paul crosses into Europe for the first time. Lydia, a Gentile merchant, believes, and later a Roman jailer and his household are baptized in the night.",
    lat: 41.0138, lon: 24.2875,
    category: "gentile",
    growth: "medium",
    believers: "households"
  },
  {
    place: "Thessalonica & Berea",
    subtitle: "Noble-Minded Hearers",
    verse: "Acts 17:1–15",
    text: "In Thessalonica some Jews and \"a great many\" devout Greeks believe. In Berea the hearers examine the Scriptures daily, and many Jews and prominent Greeks — men and women — come to faith.",
    lat: 40.6401, lon: 22.9444,
    category: "gentile",
    growth: "medium",
    believers: "many Greeks & Jews"
  },
  {
    place: "Athens",
    subtitle: "Reasoning at the Areopagus",
    verse: "Acts 17:16–34",
    text: "In the philosophical heart of the Gentile world, Paul stands before the Areopagus and reasons from the \"unknown god\" altar to the resurrection of Christ. Some sneer, but some believe — including Dionysius and Damaris.",
    lat: 37.9838, lon: 23.7275,
    category: "gentile",
    growth: "small",
    believers: "a few, named"
  },
  {
    place: "Corinth",
    subtitle: "Eighteen Months Among the Nations",
    verse: "Acts 18:1–17",
    text: "Paul settles in the bustling Gentile port city of Corinth for a year and a half, teaching \"the word of God\" and building one of the largest Gentile congregations of the early church.",
    lat: 37.9058, lon: 22.8781,
    category: "gentile",
    growth: "large",
    believers: "a large church"
  },
  {
    place: "Ephesus",
    subtitle: "\"All of Asia\" Hears the Word",
    verse: "Acts 19:1–41",
    text: "Paul teaches daily in Ephesus for two years, \"so that all the residents of Asia heard the word of the Lord.\" The gospel's impact is so great that a riot breaks out among silversmiths whose idol trade is threatened.",
    lat: 37.9495, lon: 27.3639,
    category: "gentile",
    growth: "huge",
    believers: "all of Asia"
  },
  {
    place: "Caesarea",
    subtitle: "Before Governors and a King",
    verse: "Acts 21:27–26:32",
    text: "Arrested in Jerusalem, Paul is held in Caesarea and testifies to the gospel before Roman governors Felix and Festus, and before King Agrippa — carrying the message into the halls of imperial power.",
    lat: 32.5000, lon: 34.9000,
    category: "gentile",
    growth: "medium",
    believers: "rulers hear it"
  },
  {
    place: "Rome",
    subtitle: "To the Ends of the Earth",
    verse: "Acts 27:1–28:31",
    text: "After a shipwreck off Malta, Paul arrives in Rome, the capital of the Gentile world. Under guard, he still proclaims \"the kingdom of God and teaches about the Lord Jesus Christ with all boldness and without hindrance.\" Acts 1:8 is fulfilled.",
    lat: 41.9028, lon: 12.4964,
    category: "gentile",
    growth: "huge",
    believers: "the empire's capital"
  }
];

/* Category display metadata */
const CATEGORIES = {
  jewish:     { label: "To the Jew First",        color: 0x5b8fd1 },
  transition: { label: "Samaritans & God-fearers", color: 0x9b6bcc },
  gentile:    { label: "To the Nations",           color: 0xe0a544 }
};

/* Growth magnitude -> particle count & pulse scale */
const GROWTH = {
  small:  { count: 8,  scale: 0.6 },
  medium: { count: 16, scale: 1.0 },
  large:  { count: 28, scale: 1.4 },
  huge:   { count: 42, scale: 1.9 }
};

/* Region labels, in two layers.
   era "roman"  — the provinces and peoples as Acts knows them, so the map
                  reads in the same terms as the narrative ("all of Asia",
                  "come over to Macedonia"). Several are named in Acts 2:9–11.
   era "modern" — the countries standing in those places today, for bearings.
   rank 1 shows at any zoom; rank 2 only once the camera is close enough
   for the extra names not to crowd each other. */
const REGIONS = [
  // --- Roman world, Acts era ---
  { name: "JUDEA",       lat: 31.4,  lon: 35.4,  era: "roman", rank: 1 },
  { name: "SAMARIA",     lat: 32.4,  lon: 35.2,  era: "roman", rank: 2 },
  { name: "GALILEE",     lat: 32.9,  lon: 35.5,  era: "roman", rank: 2 },
  { name: "SYRIA",       lat: 34.8,  lon: 38.4,  era: "roman", rank: 1 },
  { name: "ARABIA",      lat: 28.5,  lon: 40.5,  era: "roman", rank: 2 },
  { name: "EGYPT",       lat: 26.5,  lon: 30.0,  era: "roman", rank: 1 },
  { name: "CYRENAICA",   lat: 30.5,  lon: 21.0,  era: "roman", rank: 2 },
  { name: "AFRICA",      lat: 33.5,  lon: 9.5,   era: "roman", rank: 2 },
  { name: "AETHIOPIA",   lat: 17.5,  lon: 33.5,  era: "roman", rank: 2 },
  { name: "ASIA",        lat: 38.9,  lon: 29.4,  era: "roman", rank: 1 },
  { name: "PHRYGIA",     lat: 38.3,  lon: 31.2,  era: "roman", rank: 2 },
  { name: "GALATIA",     lat: 39.7,  lon: 33.4,  era: "roman", rank: 1 },
  { name: "CAPPADOCIA",  lat: 38.6,  lon: 36.2,  era: "roman", rank: 2 },
  { name: "CILICIA",     lat: 37.0,  lon: 34.3,  era: "roman", rank: 2 },
  { name: "PAMPHYLIA",   lat: 36.9,  lon: 31.0,  era: "roman", rank: 2 },
  { name: "LYCIA",       lat: 36.4,  lon: 29.6,  era: "roman", rank: 2 },
  { name: "BITHYNIA",    lat: 40.7,  lon: 31.0,  era: "roman", rank: 2 },
  { name: "PONTUS",      lat: 40.8,  lon: 36.8,  era: "roman", rank: 2 },
  { name: "MACEDONIA",   lat: 41.2,  lon: 22.3,  era: "roman", rank: 1 },
  { name: "ACHAIA",      lat: 38.3,  lon: 22.3,  era: "roman", rank: 1 },
  { name: "THRACE",      lat: 41.9,  lon: 26.3,  era: "roman", rank: 2 },
  { name: "ILLYRICUM",   lat: 43.6,  lon: 18.4,  era: "roman", rank: 2 },
  { name: "ITALIA",      lat: 42.7,  lon: 12.8,  era: "roman", rank: 1 },
  { name: "SICILIA",     lat: 37.6,  lon: 14.2,  era: "roman", rank: 2 },
  { name: "CRETE",       lat: 35.2,  lon: 24.9,  era: "roman", rank: 2 },
  { name: "CYPRUS",      lat: 35.0,  lon: 33.2,  era: "roman", rank: 2 },
  { name: "MELITA",      lat: 35.9,  lon: 14.4,  era: "roman", rank: 2 },
  { name: "GAUL",        lat: 46.8,  lon: 2.5,   era: "roman", rank: 1 },
  { name: "HISPANIA",    lat: 40.2,  lon: -4.0,  era: "roman", rank: 1 },
  { name: "BRITANNIA",   lat: 52.6,  lon: -1.8,  era: "roman", rank: 2 },
  { name: "GERMANIA",    lat: 51.2,  lon: 10.2,  era: "roman", rank: 2 },
  { name: "DACIA",       lat: 45.8,  lon: 24.6,  era: "roman", rank: 2 },
  { name: "ARMENIA",     lat: 40.0,  lon: 44.0,  era: "roman", rank: 2 },
  { name: "MESOPOTAMIA", lat: 34.5,  lon: 43.0,  era: "roman", rank: 2 },
  { name: "PARTHIA",     lat: 33.5,  lon: 55.0,  era: "roman", rank: 1 },
  { name: "MEDIA",       lat: 35.5,  lon: 48.5,  era: "roman", rank: 2 },

  // --- modern countries ---
  { name: "ISRAEL",       lat: 31.3, lon: 34.9,  era: "modern", rank: 2 },
  { name: "JORDAN",       lat: 31.0, lon: 36.9,  era: "modern", rank: 2 },
  { name: "LEBANON",      lat: 33.9, lon: 35.9,  era: "modern", rank: 2 },
  { name: "SYRIA",        lat: 35.0, lon: 38.4,  era: "modern", rank: 1 },
  { name: "TURKEY",       lat: 39.2, lon: 33.5,  era: "modern", rank: 1 },
  { name: "GREECE",       lat: 39.4, lon: 22.2,  era: "modern", rank: 1 },
  { name: "ITALY",        lat: 42.8, lon: 12.8,  era: "modern", rank: 1 },
  { name: "EGYPT",        lat: 26.5, lon: 29.8,  era: "modern", rank: 1 },
  { name: "SAUDI ARABIA", lat: 23.5, lon: 45.0,  era: "modern", rank: 1 },
  { name: "IRAQ",         lat: 33.2, lon: 43.5,  era: "modern", rank: 1 },
  { name: "IRAN",         lat: 32.8, lon: 54.0,  era: "modern", rank: 1 },
  { name: "CYPRUS",       lat: 35.0, lon: 33.2,  era: "modern", rank: 2 },
  { name: "LIBYA",        lat: 27.5, lon: 17.5,  era: "modern", rank: 1 },
  { name: "TUNISIA",      lat: 34.2, lon: 9.5,   era: "modern", rank: 2 },
  { name: "ALGERIA",      lat: 28.2, lon: 2.5,   era: "modern", rank: 1 },
  { name: "MOROCCO",      lat: 31.8, lon: -6.5,  era: "modern", rank: 2 },
  { name: "SPAIN",        lat: 40.2, lon: -3.7,  era: "modern", rank: 1 },
  { name: "FRANCE",       lat: 46.8, lon: 2.4,   era: "modern", rank: 1 },
  { name: "GERMANY",      lat: 51.2, lon: 10.4,  era: "modern", rank: 1 },
  { name: "POLAND",       lat: 52.1, lon: 19.4,  era: "modern", rank: 2 },
  { name: "UKRAINE",      lat: 49.2, lon: 32.0,  era: "modern", rank: 1 },
  { name: "ROMANIA",      lat: 45.9, lon: 25.0,  era: "modern", rank: 2 },
  { name: "BULGARIA",     lat: 42.7, lon: 25.4,  era: "modern", rank: 2 },
  { name: "SERBIA",       lat: 44.0, lon: 20.9,  era: "modern", rank: 2 },
  { name: "AUSTRIA",      lat: 47.6, lon: 14.1,  era: "modern", rank: 2 },
  { name: "UNITED KINGDOM", lat: 53.2, lon: -2.4, era: "modern", rank: 1 },
  { name: "RUSSIA",       lat: 56.0, lon: 45.0,  era: "modern", rank: 1 },
  { name: "SUDAN",        lat: 15.5, lon: 30.0,  era: "modern", rank: 1 },
  { name: "ETHIOPIA",     lat: 9.0,  lon: 39.5,  era: "modern", rank: 1 },
  { name: "KAZAKHSTAN",   lat: 48.0, lon: 67.0,  era: "modern", rank: 1 },
  { name: "INDIA",        lat: 22.0, lon: 79.0,  era: "modern", rank: 1 },
  { name: "NIGERIA",      lat: 9.5,  lon: 8.0,   era: "modern", rank: 2 },
  { name: "CHAD",         lat: 15.0, lon: 18.5,  era: "modern", rank: 2 }
];
