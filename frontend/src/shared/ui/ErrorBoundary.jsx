import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary поймал ошибку", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
          <h2>Не удалось загрузить 3D-сцену</h2>
          <p>{this.state.error?.message || "Подробности смотри в консоли."}</p>
          <p style={{ fontSize: '0.875rem', marginTop: '1rem', color: '#6b7280' }}>
            Проверь файлы в <b>frontend/public</b>: <b>scene.bin</b>, <b>pirate_island/</b> для экрана входа или <b>pirate_ship.glb</b> для игрового поля.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
