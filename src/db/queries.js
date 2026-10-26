import { isoDaysAgo, toISODate, todayISO } from '../utils/date';

/** Estado completo del ciclo activo. */
export async function getCycleState(db) {
  const cycle = await db.getFirstAsync(
    'SELECT * FROM cycle WHERE activo = 1 ORDER BY id LIMIT 1'
  );
  if (!cycle) return null;

  const days = await db.getAllAsync(
    'SELECT id, orden, nombre FROM day_template WHERE cycle_id = ? ORDER BY orden, id',
    cycle.id
  );
  const count = days.length;
  if (count === 0) {
    return { cycle, days, currentDay: null, nextDay: null, index: 0, count: 0 };
  }

  let index = days.findIndex((day) => day.orden === cycle.posicion_actual);
  if (index < 0) {
    index = ((cycle.posicion_actual % count) + count) % count;
  }

  return {
    cycle,
    days,
    currentDay: days[index],
    nextDay: days[(index + 1) % count],
    index,
    count,
  };
}

/** Ejercicios configurados para un día, con sus datos de catálogo. */
export async function getDayExercises(db, dayTemplateId) {
  return db.getAllAsync(
    `SELECT
       de.id AS dayExerciseId,
       de.orden AS orden,
       e.id AS exerciseId,
       e.nombre AS nombre,
       e.grupo_muscular AS grupoMuscular,
       e.ruta_imagen AS rutaImagen,
       e.instrucciones AS instrucciones
     FROM day_exercise de
     JOIN exercise e ON e.id = de.exercise_id
     WHERE de.day_template_id = ?
     ORDER BY de.orden, de.id`,
    dayTemplateId
  );
}

/** Sesiones registradas en una fecha (YYYY-MM-DD). */
export async function getSessionsByDate(db, fecha = todayISO()) {
  return db.getAllAsync(
    `SELECT ws.id, ws.estado, ws.day_template_id AS dayTemplateId, dt.nombre AS dia
     FROM workout_session ws
     LEFT JOIN day_template dt ON dt.id = ws.day_template_id
     WHERE ws.fecha = ?
     ORDER BY ws.id DESC`,
    fecha
  );
}

/** Última medición corporal. */
export async function getLastMeasurement(db) {
  return db.getFirstAsync(
    'SELECT * FROM body_measurement ORDER BY fecha DESC, id DESC LIMIT 1'
  );
}

/** Serie de peso para el gráfico, desde hace `periodDays` días. */
export async function getWeightSeries(db, periodDays = 30) {
  return db.getAllAsync(
    `SELECT id, fecha, peso
     FROM body_measurement
     WHERE peso IS NOT NULL AND fecha >= ?
     ORDER BY fecha ASC, id ASC`,
    isoDaysAgo(periodDays)
  );
}

/**
 * Últimas dos mediciones + medidas configurables, para mostrar valor y variación.
 */
export async function getMetricSnapshot(db) {
  const measurements = await db.getAllAsync(
    'SELECT * FROM body_measurement ORDER BY fecha DESC, id DESC LIMIT 2'
  );
  if (measurements.length === 0) {
    return { latest: null, previous: null, metrics: [] };
  }

  const [latest, previous] = measurements;

  const metricTypes = await db.getAllAsync(
    'SELECT * FROM metric_type ORDER BY id ASC'
  );

  const latestValues = await db.getAllAsync(
    'SELECT metric_type_id AS metricTypeId, valor FROM body_metric_value WHERE measurement_id = ?',
    latest.id
  );
  const previousValues = previous
    ? await db.getAllAsync(
        'SELECT metric_type_id AS metricTypeId, valor FROM body_metric_value WHERE measurement_id = ?',
        previous.id
      )
    : [];

  const latestMap = new Map(
    latestValues.map((row) => [row.metricTypeId, row.valor])
  );
  const previousMap = new Map(
    previousValues.map((row) => [row.metricTypeId, row.valor])
  );

  const metrics = metricTypes
    .map((type) => {
      const valor = latestMap.get(type.id) ?? null;
      const anterior = previousMap.get(type.id) ?? null;
      return {
        id: type.id,
        nombre: type.nombre,
        unidad: type.unidad,
        valor,
        anterior,
        delta:
          valor != null && anterior != null ? valor - anterior : null,
      };
    })
    .filter((metric) => metric.valor != null);

  return { latest, previous: previous ?? null, metrics };
}

/**
 * Cierra una sesión como completada, guarda sus series y avanza el ciclo.
 * El avance ocurre SOLO acá: el descanso no mueve `posicion_actual`.
 */
export async function completeWorkout(db, { dayTemplateId, sets, fecha }) {
  if (!sets?.length) {
    throw new Error('Agregá al menos una serie antes de finalizar.');
  }

  await db.withExclusiveTransactionAsync(async (txn) => {
    const session = await txn.runAsync(
      'INSERT INTO workout_session (fecha, day_template_id, estado) VALUES (?, ?, ?)',
      fecha ?? todayISO(),
      dayTemplateId,
      'completada'
    );

    for (const set of sets) {
      await txn.runAsync(
        'INSERT INTO workout_set (session_id, exercise_id, numero_serie, peso, repeticiones) VALUES (?, ?, ?, ?, ?)',
        session.lastInsertRowId,
        set.exerciseId,
        set.numeroSerie,
        set.peso,
        set.repeticiones
      );
    }

    const cycle = await txn.getFirstAsync(
      'SELECT * FROM cycle WHERE activo = 1 ORDER BY id LIMIT 1'
    );
    if (!cycle) return;

    const days = await txn.getAllAsync(
      'SELECT id, orden FROM day_template WHERE cycle_id = ? ORDER BY orden, id',
      cycle.id
    );
    if (days.length === 0) return;

    const currentIndex = Math.max(
      0,
      days.findIndex((day) => day.orden === cycle.posicion_actual)
    );
    const nextDay = days[(currentIndex + 1) % days.length];
    await txn.runAsync(
      'UPDATE cycle SET posicion_actual = ? WHERE id = ?',
      nextDay.orden,
      cycle.id
    );
  });
}

/** Marca el día como descanso. NO avanza el ciclo. */
export async function markRestDay(db, { dayTemplateId, fecha }) {
  await db.runAsync(
    'INSERT INTO workout_session (fecha, day_template_id, estado) VALUES (?, ?, ?)',
    fecha ?? todayISO(),
    dayTemplateId,
    'descanso'
  );
}

/** Catálogo con búsqueda opcional por nombre o grupo muscular. */
export async function getExerciseCatalog(db, search = '') {
  const term = search.trim();
  if (!term) {
    return db.getAllAsync(
      'SELECT * FROM exercise ORDER BY grupo_muscular, nombre'
    );
  }
  const like = `%${term}%`;
  return db.getAllAsync(
    `SELECT * FROM exercise
     WHERE nombre LIKE ? OR grupo_muscular LIKE ?
     ORDER BY grupo_muscular, nombre`,
    like,
    like
  );
}

/** Alta de ejercicio en el catálogo. */
export async function createExercise(db, { nombre, grupoMuscular, instrucciones, rutaImagen }) {
  const result = await db.runAsync(
    'INSERT INTO exercise (nombre, grupo_muscular, ruta_imagen, instrucciones) VALUES (?, ?, ?, ?)',
    nombre.trim(),
    grupoMuscular?.trim() || 'General',
    rutaImagen ?? null,
    instrucciones?.trim() || null
  );
  return result.lastInsertRowId;
}

/** Estatura del perfil (para autocompletar mediciones). */
export async function getProfile(db) {
  return db.getFirstAsync('SELECT * FROM user_profile ORDER BY id LIMIT 1');
}

/** Guarda la estatura en el perfil para autocompletar próximas mediciones. */
export async function updateProfileHeight(db, estaturaCm) {
  const profile = await getProfile(db);
  if (!profile) return;
  await db.runAsync(
    'UPDATE user_profile SET estatura_cm = ? WHERE id = ?',
    estaturaCm,
    profile.id
  );
}

/** Actualiza la foto de un ejercicio y devuelve la ruta anterior. */
export async function updateExerciseImage(db, exerciseId, rutaImagen) {
  const previous = await db.getFirstAsync(
    'SELECT ruta_imagen AS rutaImagen FROM exercise WHERE id = ?',
    exerciseId
  );
  await db.runAsync(
    'UPDATE exercise SET ruta_imagen = ? WHERE id = ?',
    rutaImagen ?? null,
    exerciseId
  );
  return previous?.rutaImagen ?? null;
}

/* ------------------------------------------------------------------ */
/* Editor de ciclo                                                    */
/* ------------------------------------------------------------------ */

/** Ciclo activo con sus días y la cantidad de ejercicios de cada uno. */
export async function getEditableCycle(db) {
  const cycle = await db.getFirstAsync(
    'SELECT * FROM cycle WHERE activo = 1 ORDER BY id LIMIT 1'
  );
  if (!cycle) return null;

  const days = await db.getAllAsync(
    `SELECT
       dt.id,
       dt.orden,
       dt.nombre,
       (
         SELECT COUNT(*) FROM day_exercise de
         WHERE de.day_template_id = dt.id
       ) AS exerciseCount
     FROM day_template dt
     WHERE dt.cycle_id = ?
     ORDER BY dt.orden, dt.id`,
    cycle.id
  );

  return { cycle, days };
}

export async function renameCycle(db, cycleId, nombre) {
  const trimmed = nombre.trim();
  if (!trimmed) throw new Error('El nombre del ciclo no puede estar vacío.');
  await db.runAsync('UPDATE cycle SET nombre = ? WHERE id = ?', trimmed, cycleId);
}

export async function createCycleDay(db, { cycleId, nombre }) {
  const trimmed = nombre.trim();
  if (!trimmed) throw new Error('Poné un nombre para el día.');

  const row = await db.getFirstAsync(
    'SELECT COALESCE(MAX(orden), -1) + 1 AS next FROM day_template WHERE cycle_id = ?',
    cycleId
  );
  const result = await db.runAsync(
    'INSERT INTO day_template (cycle_id, orden, nombre) VALUES (?, ?, ?)',
    cycleId,
    row?.next ?? 0,
    trimmed
  );
  return result.lastInsertRowId;
}

export async function renameCycleDay(db, dayId, nombre) {
  const trimmed = nombre.trim();
  if (!trimmed) throw new Error('Poné un nombre para el día.');
  await db.runAsync('UPDATE day_template SET nombre = ? WHERE id = ?', trimmed, dayId);
}

/**
 * Borra un día y renumera el resto. Si el día borrado era el actual,
 * el puntero pasa al día que ocupa su lugar.
 */
export async function deleteCycleDay(db, dayId) {
  await db.withExclusiveTransactionAsync(async (txn) => {
    const day = await txn.getFirstAsync(
      'SELECT * FROM day_template WHERE id = ?',
      dayId
    );
    if (!day) return;

    const days = await txn.getAllAsync(
      'SELECT id, orden FROM day_template WHERE cycle_id = ? ORDER BY orden, id',
      day.cycle_id
    );
    if (days.length <= 1) {
      throw new Error('El ciclo necesita al menos un día.');
    }

    const cycle = await txn.getFirstAsync(
      'SELECT * FROM cycle WHERE id = ?',
      day.cycle_id
    );
    const currentDayId =
      days.find((item) => item.orden === cycle?.posicion_actual)?.id ??
      days[0].id;
    const removedIndex = days.findIndex((item) => item.id === dayId);

    await txn.runAsync('DELETE FROM day_template WHERE id = ?', dayId);

    const remaining = days.filter((item) => item.id !== dayId);
    for (let index = 0; index < remaining.length; index += 1) {
      await txn.runAsync(
        'UPDATE day_template SET orden = ? WHERE id = ?',
        index,
        remaining[index].id
      );
    }

    let nextIndex = remaining.findIndex((item) => item.id === currentDayId);
    if (nextIndex < 0) {
      nextIndex = Math.min(removedIndex, remaining.length - 1);
    }
    await txn.runAsync(
      'UPDATE cycle SET posicion_actual = ? WHERE id = ?',
      Math.max(0, nextIndex),
      day.cycle_id
    );
  });
}

/**
 * Mueve un día una posición arriba o abajo (direction -1 / 1) y conserva
 * el día actual: el puntero se recalcula según la nueva numeración.
 */
export async function moveCycleDay(db, dayId, direction) {
  await db.withExclusiveTransactionAsync(async (txn) => {
    const day = await txn.getFirstAsync(
      'SELECT * FROM day_template WHERE id = ?',
      dayId
    );
    if (!day) return;

    const days = await txn.getAllAsync(
      'SELECT id, orden FROM day_template WHERE cycle_id = ? ORDER BY orden, id',
      day.cycle_id
    );
    const index = days.findIndex((item) => item.id === dayId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= days.length) return;

    const cycle = await txn.getFirstAsync(
      'SELECT * FROM cycle WHERE id = ?',
      day.cycle_id
    );
    const currentDayId =
      days.find((item) => item.orden === cycle?.posicion_actual)?.id ??
      days[0].id;

    const [moved] = days.splice(index, 1);
    days.splice(target, 0, moved);

    for (let position = 0; position < days.length; position += 1) {
      await txn.runAsync(
        'UPDATE day_template SET orden = ? WHERE id = ?',
        position,
        days[position].id
      );
    }

    const newPosition = days.findIndex((item) => item.id === currentDayId);
    await txn.runAsync(
      'UPDATE cycle SET posicion_actual = ? WHERE id = ?',
      newPosition < 0 ? 0 : newPosition,
      day.cycle_id
    );
  });
}

/** Agrega un ejercicio al final de un día. */
export async function addExerciseToDay(db, dayTemplateId, exerciseId) {
  const row = await db.getFirstAsync(
    'SELECT COALESCE(MAX(orden), -1) + 1 AS next FROM day_exercise WHERE day_template_id = ?',
    dayTemplateId
  );
  const result = await db.runAsync(
    'INSERT INTO day_exercise (day_template_id, exercise_id, orden) VALUES (?, ?, ?)',
    dayTemplateId,
    exerciseId,
    row?.next ?? 0
  );
  return result.lastInsertRowId;
}

/** Quita un ejercicio del día y renumera los restantes. */
export async function removeDayExercise(db, dayExerciseId) {
  await db.withExclusiveTransactionAsync(async (txn) => {
    const row = await txn.getFirstAsync(
      'SELECT * FROM day_exercise WHERE id = ?',
      dayExerciseId
    );
    if (!row) return;

    await txn.runAsync('DELETE FROM day_exercise WHERE id = ?', dayExerciseId);
    const rest = await txn.getAllAsync(
      'SELECT id FROM day_exercise WHERE day_template_id = ? ORDER BY orden, id',
      row.day_template_id
    );
    for (let index = 0; index < rest.length; index += 1) {
      await txn.runAsync(
        'UPDATE day_exercise SET orden = ? WHERE id = ?',
        index,
        rest[index].id
      );
    }
  });
}

/** Mueve un ejercicio del día una posición (direction -1 / 1). */
export async function moveDayExercise(db, dayExerciseId, direction) {
  await db.withExclusiveTransactionAsync(async (txn) => {
    const row = await txn.getFirstAsync(
      'SELECT * FROM day_exercise WHERE id = ?',
      dayExerciseId
    );
    if (!row) return;

    const rows = await txn.getAllAsync(
      'SELECT id FROM day_exercise WHERE day_template_id = ? ORDER BY orden, id',
      row.day_template_id
    );
    const index = rows.findIndex((item) => item.id === dayExerciseId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= rows.length) return;

    const [moved] = rows.splice(index, 1);
    rows.splice(target, 0, moved);

    for (let position = 0; position < rows.length; position += 1) {
      await txn.runAsync(
        'UPDATE day_exercise SET orden = ? WHERE id = ?',
        position,
        rows[position].id
      );
    }
  });
}

/* ------------------------------------------------------------------ */
/* Mediciones corporales                                              */
/* ------------------------------------------------------------------ */

export async function getMetricTypes(db) {
  return db.getAllAsync('SELECT * FROM metric_type ORDER BY id ASC');
}

/**
 * Guarda una medición completa (peso, estatura, grasa y medidas
 * configurables) dentro de una transacción.
 */
export async function createMeasurement(
  db,
  { fecha, peso, estatura, grasaCorporal, metrics }
) {
  await db.withExclusiveTransactionAsync(async (txn) => {
    const measurement = await txn.runAsync(
      `INSERT INTO body_measurement (fecha, peso, estatura, grasa_corporal)
       VALUES (?, ?, ?, ?)`,
      fecha ?? todayISO(),
      peso ?? null,
      estatura ?? null,
      grasaCorporal ?? null
    );

    for (const metric of metrics ?? []) {
      if (metric.valor == null || !Number.isFinite(Number(metric.valor))) {
        continue;
      }
      await txn.runAsync(
        `INSERT INTO body_metric_value (measurement_id, metric_type_id, valor)
         VALUES (?, ?, ?)`,
        measurement.lastInsertRowId,
        metric.metricTypeId,
        Number(metric.valor)
      );
    }
  });
}

/** Series de peso y grasa para la tabla de historial corporal. */
export async function getMeasurementHistory(db, limit = 60) {
  return db.getAllAsync(
    `SELECT * FROM body_measurement
     ORDER BY fecha DESC, id DESC
     LIMIT ?`,
    limit
  );
}

/* ------------------------------------------------------------------ */
/* Historial de entrenamientos                                        */
/* ------------------------------------------------------------------ */

/** Sesiones entre dos fechas, con cantidad de series y volumen total. */
export async function getSessionsBetween(db, desde, hasta) {
  return db.getAllAsync(
    `SELECT
       ws.id,
       ws.fecha,
       ws.estado,
       ws.day_template_id AS dayTemplateId,
       dt.nombre AS dia,
       (
         SELECT COUNT(*) FROM workout_set s WHERE s.session_id = ws.id
       ) AS series,
       (
         SELECT COALESCE(SUM(s.peso * s.repeticiones), 0)
         FROM workout_set s WHERE s.session_id = ws.id
       ) AS volumen
     FROM workout_session ws
     LEFT JOIN day_template dt ON dt.id = ws.day_template_id
     WHERE ws.fecha BETWEEN ? AND ?
     ORDER BY ws.fecha ASC, ws.id ASC`,
    desde,
    hasta
  );
}

/** Sesiones de un mes (month 0 = enero). */
export async function getSessionsByMonth(db, year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  return getSessionsBetween(db, toISODate(first), toISODate(last));
}

/** Series de una sesión, agrupables por ejercicio en la UI. */
export async function getSessionSets(db, sessionId) {
  return db.getAllAsync(
    `SELECT
       s.exercise_id AS exerciseId,
       e.nombre AS nombre,
       s.numero_serie AS numeroSerie,
       s.peso,
       s.repeticiones
     FROM workout_set s
     JOIN exercise e ON e.id = s.exercise_id
     WHERE s.session_id = ?
     ORDER BY s.exercise_id, s.numero_serie`,
    sessionId
  );
}
