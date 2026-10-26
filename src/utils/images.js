import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Directory, File, Paths } from 'expo-file-system';

/**
 * Las fotos del picker viven en la caché del sistema y pueden borrarse.
 * Las copiamos a `document/exercise-images` para que sigan disponibles
 * aunque la app se cierre o el sistema limpie archivos temporales.
 */
const IMAGE_DIR = 'exercise-images';

async function persistImage(uri, fileName) {
  if (Platform.OS === 'web') return uri;

  const directory = new Directory(Paths.document, IMAGE_DIR);
  directory.create({ intermediates: true, idempotent: true });

  const source = new File(uri);
  const extension = source.extension || getExtension(fileName) || '.jpg';
  const target = new File(
    directory,
    `ejercicio-${Date.now()}-${Math.round(Math.random() * 10000)}${extension}`
  );

  await source.copy(target);
  return target.uri;
}

function getExtension(fileName) {
  if (!fileName) return null;
  const match = /\.([a-zA-Z0-9]+)$/.exec(fileName);
  return match ? `.${match[1].toLowerCase()}` : null;
}

const PICKER_OPTIONS = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [4, 3],
  quality: 0.7,
};

/**
 * Abre la cámara o la galería y devuelve la ruta definitiva de la imagen.
 * Devuelve null si el usuario cancela.
 */
export async function pickExerciseImage(source = 'library') {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new Error(
        'Necesitamos permiso para usar la cámara. Podés habilitarlo desde los ajustes del teléfono.'
      );
    }
    const result = await ImagePicker.launchCameraAsync(PICKER_OPTIONS);
    if (result.canceled || !result.assets?.length) return null;
    return persistImage(result.assets[0].uri, result.assets[0].fileName);
  }

  const result = await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
  if (result.canceled || !result.assets?.length) return null;
  return persistImage(result.assets[0].uri, result.assets[0].fileName);
}

/** Borra una foto propia; ignora rutas externas o ya eliminadas. */
export async function deleteExerciseImage(uri) {
  if (!uri || Platform.OS === 'web') return;
  if (!uri.includes(IMAGE_DIR)) return;

  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch (error) {
    console.warn('No se pudo borrar la imagen anterior:', error);
  }
}
