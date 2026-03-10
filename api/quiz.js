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

    const [rows] = await connection.execute(`
      SELECT
        e.id_record,
        imp.folderpath,
        i1.interprete  AS interprete_principal,
        ev.evenement   AS nom_evenement,
        l.lieu         AS nom_lieu,
        e.annee
      FROM
        enregistrements e
      LEFT JOIN import      imp ON e.fda_id        = imp.id
      LEFT JOIN interpretes i1  ON e.id_interprete1 = i1.id
      LEFT JOIN evenements  ev  ON e.id_evenement   = ev.id
      LEFT JOIN lieux       l   ON e.id_lieu        = l.id
      WHERE
        e.annee BETWEEN 1880 AND 2005
        AND e.id_categorie = 1
        AND imp.folderpath  IS NOT NULL AND imp.folderpath  != ''
        AND e.id_record     IS NOT NULL AND e.id_record     != ''
      ORDER BY RAND()
      LIMIT 4
    `);

    const BASE_URL = 'https://sonotek.sonerion.bzh';

    const quiz_data = rows.map(row => {
      const cleanPath = row.folderpath.replace(/^\.\//, '');
      return {
        mp3_url:    `${BASE_URL}/data/${cleanPath}/${row.id_record}.mp3`,
        interprete: row.interprete_principal,
        evenement:  row.nom_evenement,
        lieu:       row.nom_lieu,
        annee:      row.annee,
      };
    });

    return res.status(200).json(quiz_data);

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
