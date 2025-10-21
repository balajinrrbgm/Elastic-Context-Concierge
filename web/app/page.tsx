import Concierge from './components/Concierge';

export default function Home() {
  const examples = [
    'Summarize the product release notes',
    'What is the remote work policy?',
    'How is hybrid work scheduled?'
  ];

  return (
    <main>
      <Concierge examples={examples} />
    </main>
  );
}
