import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

const PHOTO_SIZE = 256;

export class PhotoPermissionError extends Error {}

// Abre la galería o la cámara y devuelve la foto como data URI JPEG cuadrada de 256 px, o null si se canceló.
export async function pickProfilePhoto(source: "library" | "camera") {
  if (source === "camera") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new PhotoPermissionError("Necesitamos permiso de cámara para tomar tu foto.");
  }

  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 1 };
  const result = source === "camera"
    ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);

  if (result.canceled || !result.assets[0]) return null;
  const { uri, width, height } = result.assets[0];

  // En web no hay editor de recorte, así que recortamos el centro para dejarla cuadrada.
  const side = Math.min(width, height);
  const context = ImageManipulator.manipulate(uri);
  if (width && height && width !== height) {
    context.crop({ originX: (width - side) / 2, originY: (height - side) / 2, width: side, height: side });
  }
  const rendered = await context.resize({ width: PHOTO_SIZE, height: PHOTO_SIZE }).renderAsync();
  const saved = await rendered.saveAsync({ base64: true, compress: 0.7, format: SaveFormat.JPEG });

  if (!saved.base64) throw new Error("No se pudo procesar la imagen.");
  return `data:image/jpeg;base64,${saved.base64}`;
}
