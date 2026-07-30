import Dexie from 'dexie'

export const db = new Dexie('DiagPlombDB')

db.version(1).stores({
  chantiers: '++id, name, client, address, date',
  pieces: '++id, chantierId, name, numUd',
  mesures: '++id, chantierId, pieceId, num, numUd, Pb, precision, date, livetime'
})

export default db
