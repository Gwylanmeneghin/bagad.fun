import mysql from 'mysql2/promise';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  // Autoriser uniquement bagad.fun (CORS pour le front)
  res.setHeader('Access-Control-Allow-Origin', 'https://bagad.fun');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let connection;
  try {
    connection = await mysql.createConnection({
      host:     process.env.DB_HOST,
      database: process.env.DB_NAME,
      user:     process.env.DB_USER,
      password: process.env.DB_PASS,
      charset:  'utf8',
    });

    // Requête 1 : 4 questions aléatoires — bagadoù de 1ère catégorie uniquement
    const [rows] = await connection.execute(`
      SELECT
        e.id_record,
        imp.folderpath,
        i1.interprete  AS interprete_principal,
        e.annee
      FROM
        enregistrements e
      LEFT JOIN import      imp ON e.fda_id        = imp.id
      LEFT JOIN interpretes i1  ON e.id_interprete1 = i1.id
      WHERE
        e.annee BETWEEN 1949 AND 2025
        AND e.id_categorie = 1
        AND imp.folderpath  IS NOT NULL AND imp.folderpath  != ''
        AND e.id_record     IS NOT NULL AND e.id_record     != ''
      ORDER BY RAND()
      LIMIT 4
    `);

    // Requête 2 : tous les interprètes et années distincts (pour les fausses réponses)
    const [optionRows] = await connection.execute(`
      SELECT DISTINCT
        i1.interprete AS interprete,
        e.annee
      FROM
        enregistrements e
      LEFT JOIN interpretes i1 ON e.id_interprete1 = i1.id
      WHERE
        e.annee BETWEEN 1949 AND 2025
        AND e.id_categorie = 1
        AND i1.interprete IS NOT NULL AND i1.interprete != ''
    `);

    const BASE_URL = 'https://sonotek.sonerion.bzh';

    const questions = rows.map(row => {
      const cleanPath = row.folderpath.replace(/^\.\//, '');
      return {
        mp3_url:    `${BASE_URL}/data/${cleanPath}/${row.id_record}.mp3`,
        interprete: row.interprete_principal,
        annee:      row.annee,
      };
    });

    const allBands = [...new Set(optionRows.map(r => r.interprete).filter(Boolean))];
    const allYears = [...new Set(optionRows.map(r => String(r.annee)).filter(Boolean))];

    return res.status(200).json({ questions, allBands, allYears });

  } catch (err) {
    console.error('DB error:', err);
    return res.status(500).json({
      error:   'Impossible de récupérer les données.',
      details: err.message,
    });
  } finally {
    if (connection) await connection.end();
  }
}
