import { type ImageAttachment } from '../types'
import './ImagePreview.css'

interface ImagePreviewProps {
  images: ImageAttachment[]
  onRemove?: (id: string) => void
  readonly?: boolean
}

function ImagePreview({ images, onRemove, readonly = false }: ImagePreviewProps): React.ReactElement {
  if (images.length === 0) {
    return <></>
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="image-preview-container">
      {images.map(img => (
        <div key={img.id} className="image-preview-item">
          <div className="image-wrapper">
            <img src={img.url} alt={img.name} className="preview-image" />
            {!readonly && onRemove && (
              <button 
                onClick={() => onRemove(img.id)}
                className="remove-button"
                title="Remove image"
              >
                ×
              </button>
            )}
          </div>
          <div className="image-info">
            <span className="image-name" title={img.name}>{img.name}</span>
            <span className="image-size">{formatFileSize(img.size)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default ImagePreview
