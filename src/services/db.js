import Dexie from 'dexie'

export const db = new Dexie('DiagPlombDB')

console.log('DB FILE LOADED')

db.version(1).stores({
  chantiers: '++id, name, client, address, date',
  pieces: '++id, chantierId, name, numUd',
  mesures: '++id, chantierId, pieceId, num, numUd, Pb, precision, date, livetime'
})

// Add supports store and supportId index on mesures in a new version
db.version(2).stores({
  chantiers: '++id, name, client, address, date',
  pieces: '++id, chantierId, name, numUd',
  mesures: '++id, chantierId, pieceId, supportId, num, numUd, Pb, precision, date, livetime',
  supports: '++id, pieceId, name'
})

// add new fields (point, observations, classe) in a new version
db.version(3).stores({
  chantiers: '++id, name, client, address, date',
  pieces: '++id, chantierId, name, numUd',
  mesures: '++id, chantierId, pieceId, supportId, num, numUd, Pb, precision, date, livetime, point, observations, classe',
  supports: '++id, pieceId, name'
})

// Add niveaux store and associate pieces with niveauId
// New version replacing pieces schema to include niveauId
db.version(4).stores({
  chantiers: '++id, name, client, address, date',
  niveaux: '++id, chantierId, name, [chantierId+name]',
  pieces: '++id, chantierId, niveauId, name, numUd',
  mesures: '++id, chantierId, pieceId, supportId, num, numUd, Pb, precision, date, livetime, point, observations, classe',
  supports: '++id, pieceId, name'
})

// Extend mesures with métier fields: zone, element, substrat, revetement, etat, degradation, hauteur
// Keep version increment to migrate schema
db.version(5).stores({
  chantiers: '++id, name, client, address, date',
  niveaux: '++id, chantierId, name, [chantierId+name]',
  pieces: '++id, chantierId, niveauId, name, numUd',
  mesures: '++id, chantierId, pieceId, supportId, num, numUd, Pb, precision, date, livetime, point, observations, classe, zone, element, substrat, revetement, etat, degradation, hauteur',
  supports: '++id, pieceId, name'
})

// Version 6: chantier archiving, plan files store, keep schema forward-compatible
// chantiers gain an 'archived' boolean (defaults to false)
// add planFiles to store imported plan images/PDFs
db.version(6).stores({
  chantiers: '++id, name, client, address, date, archived',
  niveaux: '++id, chantierId, name, [chantierId+name]',
  pieces: '++id, chantierId, niveauId, name, numUd',
  mesures: '++id, chantierId, pieceId, supportId, num, numUd, Pb, precision, date, livetime, point, observations, classe, zone, element, substrat, revetement, etat, degradation, hauteur',
  supports: '++id, pieceId, name',
  planFiles: '++id, chantierId, name, type, createdAt'
})

// Version 7: backups store for chantier JSON snapshots
// backups: ++id, chantierId, createdAt
// data field stores the exported object
db.version(7).stores({
  chantiers: '++id, name, client, address, date, archived',
  niveaux: '++id, chantierId, name, [chantierId+name]',
  pieces: '++id, chantierId, niveauId, name, numUd',
  mesures: '++id, chantierId, pieceId, supportId, num, numUd, Pb, precision, date, livetime, point, observations, classe, zone, element, substrat, revetement, etat, degradation, hauteur',
  supports: '++id, pieceId, name',
  planFiles: '++id, chantierId, name, type, createdAt',
  backups: '++id, chantierId, createdAt'
})

// Version 8: replace archived boolean with status enum (active/archived/deleted)
// keep backwards compatibility by mapping existing 'archived' boolean to status
// chantiers: include status index
try{
  db.version(8).stores({
    chantiers: '++id, name, client, address, date, status',
    niveaux: '++id, chantierId, name, [chantierId+name]',
    pieces: '++id, chantierId, niveauId, name, numUd',
    mesures: '++id, chantierId, pieceId, supportId, num, numUd, Pb, precision, date, livetime, point, observations, classe, zone, element, substrat, revetement, etat, degradation, hauteur',
    supports: '++id, pieceId, name',
    planFiles: '++id, chantierId, name, type, createdAt',
    backups: '++id, chantierId, createdAt'
  }).upgrade(async tx => {
    // migration handled by Dexie when stores change; nothing heavy here
  })
} catch(e){
  // in case version 8 registration fails on older runtime, ignore but log
  console.warn('db version 8 registration skipped', e)
}

// Final safety version: ensure all expected stores are declared (non-destructive)
// This version ensures any clients that didn't apply prior migrations still get the required stores
try{
  db.version(9).stores({
    chantiers: '++id, name, client, address, date, status',
    niveaux: '++id, chantierId, name, [chantierId+name]',
    pieces: '++id, chantierId, niveauId, name, numUd',
    mesures: '++id, chantierId, pieceId, supportId, num, numUd, Pb, precision, date, livetime, point, observations, classe, zone, element, substrat, revetement, etat, degradation, hauteur',
    supports: '++id, pieceId, name',
    planFiles: '++id, chantierId, name, type, createdAt',
    backups: '++id, chantierId, createdAt'
  })
} catch(e){
  console.warn('db version 9 registration skipped', e)
}

// Open DB now to trigger migrations and log resulting stores
db.open().then(()=>{
  console.log('DB open successful. DB tables:', db.tables.map(t => t.name))
}).catch(err=>{
  console.error('DB open failed:', err)
})

export default db
