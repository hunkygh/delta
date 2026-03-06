import { useState } from 'react';

interface DocEditorProps {
  initialValue?: string;
}

export default function DocEditor({ initialValue = '' }: DocEditorProps): JSX.Element {
  const [value, setValue] = useState(initialValue);

  return (
    <section className="card">
      <h3>Doc Editor</h3>
      <textarea
        className="text-area"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Start writing..."
        rows={12}
      />
    </section>
  );
}
