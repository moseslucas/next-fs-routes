import { Link, useLoaderData } from 'react-router-dom';

export async function loader() {
  return [
    { id: 'one', name: 'Project One' },
    { id: 'two', name: 'Project Two' },
  ];
}

export default function ProjectsPage() {
  const projects = useLoaderData() as Array<{ id: string; name: string }>;

  return (
    <section>
      <h1>Projects</h1>
      {projects.map((project) => (
        <Link key={project.id} to={`/projects/${project.id}`}>
          {project.name}
        </Link>
      ))}
    </section>
  );
}
