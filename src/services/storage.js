import { db } from './db'

export const addChantier = async (c) => {
  return db.chantiers.add(c)
}
export const getChantiers = async () => {
  return db.chantiers.orderBy('date').reverse().toArray()
}
export const getChantier = async (id) => db.chantiers.get(Number(id))

export const addPiece = async (p) => db.pieces.add(p)
export const getPiecesByChantier = async (chantierId) => db.pieces.where('chantierId').equals(Number(chantierId)).toArray()

export const addMesures = async (mesArray) => db.mesures.bulkAdd(mesArray)
export const getMesuresByChantier = async (chantierId) => db.mesures.where('chantierId').equals(Number(chantierId)).toArray()

export const clearAll = async () => {
  await db.chantiers.clear(); await db.pieces.clear(); await db.mesures.clear();
}
