import { isoDaysAgo, todayISO } from '../utils/date';

const DATABASE_VERSION = 1;

/**
 * Migración + datos iniciales. Se ejecuta una sola vez por instalación
 * (SQLiteProvider onInit). Usa `PRAGMA user_version` para versionar.
 */
export async function migrateDbIfNeeded(db) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);

  const versionRow = await db.getFirstAsync('PRAGMA user_version');
  let currentVersion = versionRow?.user_version ?? 0;

  if (currentVersion === 0) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS user_profile (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        estatura_cm REAL,
        objetivo TEXT
      );

      CREATE TABLE IF NOT EXISTS exercise (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        grupo_muscular TEXT,
        ruta_imagen TEXT,
        instrucciones TEXT
      );

      CREATE TABLE IF NOT EXISTS cycle (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        activo INTEGER NOT NULL DEFAULT 0,
        posicion_actual INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS day_template (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cycle_id INTEGER NOT NULL,
        orden INTEGER NOT NULL,
        nombre TEXT NOT NULL,
        FOREIGN KEY (cycle_id) REFERENCES cycle(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS day_exercise (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        day_template_id INTEGER NOT NULL,
        exercise_id INTEGER NOT NULL,
        orden INTEGER NOT NULL,
        FOREIGN KEY (day_template_id) REFERENCES day_template(id) ON DELETE CASCADE,
        FOREIGN KEY (exercise_id) REFERENCES exercise(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS workout_session (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha TEXT NOT NULL,
        day_template_id INTEGER,
        estado TEXT NOT NULL CHECK (estado IN ('completada', 'descanso')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (day_template_id) REFERENCES day_template(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS workout_set (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        exercise_id INTEGER NOT NULL,
        numero_serie INTEGER NOT NULL,
        peso REAL,
        repeticiones INTEGER,
        FOREIGN KEY (session_id) REFERENCES workout_session(id) ON DELETE CASCADE,
        FOREIGN KEY (exercise_id) REFERENCES exercise(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS metric_type (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        unidad TEXT NOT NULL DEFAULT 'cm'
      );

      CREATE TABLE IF NOT EXISTS body_measurement (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha TEXT NOT NULL,
        peso REAL,
        estatura REAL,
        grasa_corporal REAL
      );

      CREATE TABLE IF NOT EXISTS body_metric_value (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        measurement_id INTEGER NOT NULL,
        metric_type_id INTEGER NOT NULL,
        valor REAL,
        FOREIGN KEY (measurement_id) REFERENCES body_measurement(id) ON DELETE CASCADE,
        FOREIGN KEY (metric_type_id) REFERENCES metric_type(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_session_fecha ON workout_session(fecha);
      CREATE INDEX IF NOT EXISTS idx_set_session ON workout_set(session_id);
      CREATE INDEX IF NOT EXISTS idx_day_exercise_day ON day_exercise(day_template_id);
      CREATE INDEX IF NOT EXISTS idx_measurement_fecha ON body_measurement(fecha);
    `);

    await seedInitialData(db);
    currentVersion = 1;
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}

async function seedInitialData(db) {
  await db.withExclusiveTransactionAsync(async (txn) => {
    const existing = await txn.getFirstAsync(
      'SELECT COUNT(*) AS total FROM cycle'
    );
    if ((existing?.total ?? 0) > 0) return;

    // Perfil
    await txn.runAsync(
      'INSERT INTO user_profile (estatura_cm, objetivo) VALUES (?, ?)',
      178,
      'Recomposición corporal'
    );

    // Tipos de medida configurables
    const metricTypes = [
      ['Cintura', 'cm'],
      ['Pecho', 'cm'],
      ['Brazo', 'cm'],
      ['Muslo', 'cm'],
    ];
    for (const [nombre, unidad] of metricTypes) {
      await txn.runAsync(
        'INSERT INTO metric_type (nombre, unidad) VALUES (?, ?)',
        nombre,
        unidad
      );
    }

    // Catálogo de ejercicios
    const exercises = [
      {
        nombre: 'Press de banca',
        grupo: 'Pecho',
        instrucciones:
          'Acostate en el banco con los pies firmes en el piso y los omóplatos retraídos.\n\nTomá la barra un poco más ancho que los hombros. Bajá de forma controlada hasta la línea del pecho, con los codos a unos 45° del torso.\n\nEmpujá a través del pecho y los tríceps hasta extender los brazos sin bloquear con violencia. Mantené las muñecas alineadas con los antebrazos.',
      },
      {
        nombre: 'Press militar',
        grupo: 'Hombros',
        instrucciones:
          'De pie con los pies al ancho de los hombros y el abdomen firme.\n\nSostené la barra o las mancuernas a la altura de los hombros, con las palmas hacia adelante. Empujá hacia arriba en línea recta sin arquear la espalda baja.\n\nBajá de forma controlada. Evitá usar impulso de piernas salvo que hagas una variante con push press.',
      },
      {
        nombre: 'Aperturas con mancuernas',
        grupo: 'Pecho',
        instrucciones:
          'Acostate en un banco plano con una mancuerna en cada mano y los brazos extendidos sobre el pecho, con una ligera flexión de codos.\n\nAbrí los brazos en arco hasta sentir el estiramiento del pecho, sin bajar más de lo que tu movilidad permite.\n\nCerrá el movimiento contrayendo el pecho. Usá un peso moderado: es un ejercicio de aislamiento.',
      },
      {
        nombre: 'Extensión de tríceps en polea',
        grupo: 'Tríceps',
        instrucciones:
          'Ubicate frente a la polea alta y tomá la cuerda o la barra recta.\n\nMantené los codos pegados al torso y extendé los brazos hacia abajo hasta contraer el tríceps.\n\nVolvé lentamente sin dejar que los codos se abran ni que el peso tire de tus hombros.',
      },
      {
        nombre: 'Dominadas',
        grupo: 'Espalda',
        instrucciones:
          'Colgá de la barra con las manos algo más anchas que los hombros y el cuerpo estable en tensión.\n\nDeprimí los omóplatos y tirá del cuerpo hacia arriba hasta que la barbilla supere la barra, llevando el pecho hacia ella.\n\nBajá de forma controlada hasta extender los brazos. Si aún no podés, usá banda elástica o dominadas asistidas.',
      },
      {
        nombre: 'Remo con barra',
        grupo: 'Espalda',
        instrucciones:
          'Con los pies al ancho de las caderas, inclinate desde la cadera manteniendo la espalda neutra y la barra cerca de las piernas.\n\nTirá de la barra hacia el abdomen bajo guiando con los codos hacia atrás. Juntá las escápulas arriba.\n\nBajá controlado sin perder la curvatura lumbar.',
      },
      {
        nombre: 'Curl de bíceps con barra',
        grupo: 'Bíceps',
        instrucciones:
          'De pie, con la barra tomada en supinación y los codos cerca del torso.\n\nFlexioná los codos para subir la barra sin balancear el cuerpo; el movimiento sale del bíceps, no de la espalda.\n\nBajá lentamente hasta casi extender los codos y mantené la tensión.',
      },
      {
        nombre: 'Face pull',
        grupo: 'Hombros',
        instrucciones:
          'Configurá la polea a la altura de la cara con una cuerda.\n\nTomá la cuerda con las palmas hacia adentro y tirá hacia tu cara, separando las manos y llevando los codos hacia afuera.\n\nBuscá juntar las escápulas y rotar externamente los hombros. Es ideal para la salud del hombro: priorizá técnica sobre peso.',
      },
      {
        nombre: 'Sentadilla con barra',
        grupo: 'Piernas',
        instrucciones:
          'Apoyá la barra sobre los trapecios, con los pies al ancho de los hombros y las puntas ligeramente hacia afuera.\n\nInhalá, braceá el abdomen y bajá llevando la cadera hacia atrás y abajo, con las rodillas alineadas con los pies.\n\nBajá hasta donde puedas mantener la espalda neutra y subí empujando el piso con los pies.',
      },
      {
        nombre: 'Peso muerto rumano',
        grupo: 'Isquios',
        instrucciones:
          'Sostené la barra frente a los muslos, con los pies al ancho de la cadera y las rodillas ligeramente flexionadas.\n\nLlevá la cadera hacia atrás bajando la barra cerca de las piernas, sintiendo el estiramiento de los isquiotibiales.\n\nCuando la espalda esté por perder neutralidad, empujá la cadera hacia adelante para volver. No es una sentadilla: la rodilla cambia poco.',
      },
      {
        nombre: 'Prensa de piernas',
        grupo: 'Piernas',
        instrucciones:
          'Sentate con la espalda y la cadera apoyadas por completo en el respaldo.\n\nColocá los pies al ancho de los hombros en la plataforma y empujá hasta casi extender las rodillas, sin bloquearlas.\n\nBajá de forma controlada sin que la cadera se despegue del asiento. Ajustá la profundidad a tu movilidad.',
      },
      {
        nombre: 'Elevación de talones',
        grupo: 'Gemelos',
        instrucciones:
          'De pie en una máquina o con los pies en un escalón, bajá los talones para estirar los gemelos.\n\nEmpujá hacia arriba con la punta de los pies hasta contraer al máximo los gemelos.\n\nHacé una pausa arriba y bajá lento. Evitá rebotar.',
      },
      {
        nombre: 'Zancadas con mancuernas',
        grupo: 'Piernas',
        instrucciones:
          'Con una mancuerna en cada mano, dá un paso largo hacia adelante.\n\nBajá hasta que ambas rodillas formen cerca de 90°, con el torso erguido y la rodilla delantera alineada con el pie.\n\nEmpujá con la pierna delantera para volver. Alterná piernas o completá todas las repeticiones de un lado.',
      },
      {
        nombre: 'Plancha abdominal',
        grupo: 'Core',
        instrucciones:
          'Apoyá los antebrazos y las puntas de los pies en el piso, con los codos bajo los hombros.\n\nContraé el abdomen y los glúteos para mantener el cuerpo en línea recta desde la cabeza hasta los talones. No dejes caer la cadera ni subas el culo.\n\nRespirá de forma constante y sostené el tiempo objetivo con buena técnica.',
      },
    ];

    const exerciseIds = new Map();
    for (const exercise of exercises) {
      const result = await txn.runAsync(
        'INSERT INTO exercise (nombre, grupo_muscular, instrucciones) VALUES (?, ?, ?)',
        exercise.nombre,
        exercise.grupo,
        exercise.instrucciones
      );
      exerciseIds.set(exercise.nombre, result.lastInsertRowId);
    }

    // Ciclo
    const cycleResult = await txn.runAsync(
      'INSERT INTO cycle (nombre, activo, posicion_actual) VALUES (?, ?, ?)',
      'PPL + Full Body',
      1,
      0
    );
    const cycleId = cycleResult.lastInsertRowId;

    const days = [
      {
        nombre: 'Empuje',
        exercises: [
          'Press de banca',
          'Press militar',
          'Aperturas con mancuernas',
          'Extensión de tríceps en polea',
        ],
      },
      {
        nombre: 'Jalón',
        exercises: [
          'Dominadas',
          'Remo con barra',
          'Face pull',
          'Curl de bíceps con barra',
        ],
      },
      {
        nombre: 'Piernas',
        exercises: [
          'Sentadilla con barra',
          'Peso muerto rumano',
          'Prensa de piernas',
          'Elevación de talones',
        ],
      },
      {
        nombre: 'Full Body',
        exercises: [
          'Sentadilla con barra',
          'Press de banca',
          'Remo con barra',
          'Press militar',
          'Plancha abdominal',
        ],
      },
    ];

    for (let dayIndex = 0; dayIndex < days.length; dayIndex += 1) {
      const day = days[dayIndex];
      const dayResult = await txn.runAsync(
        'INSERT INTO day_template (cycle_id, orden, nombre) VALUES (?, ?, ?)',
        cycleId,
        dayIndex,
        day.nombre
      );
      const dayId = dayResult.lastInsertRowId;

      for (
        let exerciseIndex = 0;
        exerciseIndex < day.exercises.length;
        exerciseIndex += 1
      ) {
        const exerciseName = day.exercises[exerciseIndex];
        const exerciseId = exerciseIds.get(exerciseName);
        if (!exerciseId) continue;
        await txn.runAsync(
          'INSERT INTO day_exercise (day_template_id, exercise_id, orden) VALUES (?, ?, ?)',
          dayId,
          exerciseId,
          exerciseIndex
        );
      }
    }

    // Historial corporal de ejemplo (listo para ver el gráfico)
    const measurements = [
      { daysAgo: 28, peso: 78.4, grasa: 20.2, cintura: 88, pecho: 104 },
      { daysAgo: 21, peso: 77.6, grasa: 19.7, cintura: 87, pecho: 104 },
      { daysAgo: 14, peso: 76.8, grasa: 19.1, cintura: 86, pecho: 105 },
      { daysAgo: 7, peso: 75.9, grasa: 18.8, cintura: 85, pecho: 105 },
      { daysAgo: 0, peso: 75.2, grasa: 18.5, cintura: 84, pecho: 106 },
    ];

    for (const [index, measurement] of measurements.entries()) {
      const measurementResult = await txn.runAsync(
        'INSERT INTO body_measurement (fecha, peso, estatura, grasa_corporal) VALUES (?, ?, ?, ?)',
        measurement.daysAgo === 0 ? todayISO() : isoDaysAgo(measurement.daysAgo),
        measurement.peso,
        178,
        measurement.grasa
      );
      const measurementId = measurementResult.lastInsertRowId;
      const values = [
        [1, measurement.cintura],
        [2, measurement.pecho],
        [3, 38 - index * 0.4],
        [4, 58 - index * 0.3],
      ];
      for (const [metricTypeId, valor] of values) {
        await txn.runAsync(
          'INSERT INTO body_metric_value (measurement_id, metric_type_id, valor) VALUES (?, ?, ?)',
          measurementId,
          metricTypeId,
          Number(valor.toFixed(1))
        );
      }
    }
  });
}
