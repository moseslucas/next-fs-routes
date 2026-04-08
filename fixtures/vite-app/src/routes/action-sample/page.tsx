import { Form } from 'react-router-dom';

export async function action() {
  return { ok: true };
}

export default function ActionSamplePage() {
  return (
    <Form method='post'>
      <button type='submit'>Submit</button>
    </Form>
  );
}
