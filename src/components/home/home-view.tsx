'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight, ArrowRight, ShieldCheck, Radio, Fingerprint, FlaskConical, Leaf, Menu, X, MessageCircle, CircleCheck, CircleDashed } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { HiveScene, ProductJourney, JOURNEY } from './product-journey';

interface HomeViewProps {
  contractAddress: string; networkName: string; explorerUrl: string | null;
  isLocal: boolean; whatsappNumber?: string;
}
export function HomeView({ contractAddress, networkName, explorerUrl, isLocal, whatsappNumber }: HomeViewProps) {
  const [menu, setMenu] = useState(false);
  const [batch, setBatch] = useState('');
  const wa = whatsappNumber && /^\d{8,15}$/.test(whatsappNumber) ? 'https://wa.me/' + whatsappNumber : null;
  return <div className="honey-app">
    <header className="product-nav">
      <Link className="product-brand" href="/"><Image src="/logo-mark.png" alt="" width={34} height={34} /><span>pollinator<span className="brand-dot">.</span><small>HONEY CHAIN</small></span></Link>
      <nav className={menu ? 'product-nav-links is-open' : 'product-nav-links'} aria-label="Main navigation">
        {[['journey', 'The journey'], ['system', 'The system'], ['evidence', 'Trust & evidence'], ['verify', 'Verify a jar']].map(([id, label]) => <a key={id} href={'#' + id} onClick={() => setMenu(false)}>{label}</a>)}
      </nav>
      <div className="product-nav-actions"><ThemeToggle /><Link href="/dashboard" className="portal-link">Open portal <ArrowUpRight size={16} /></Link><button className="mobile-menu" type="button" aria-label="Toggle navigation" aria-expanded={menu} onClick={() => setMenu(!menu)}>{menu ? <X /> : <Menu />}</button></div>
    </header>
    <main>
      <section className="product-hero">
        <div className="hero-copy">
          <p className="eyebrow"><span className="status-dot" /> SMART BEEKEEPING. SHARED PROVENANCE.</p>
          <h1>Good honey.<br />A clearer <span>story.</span></h1>
          <p className="hero-description">From a rural bee box to the jar in your hand. Connect hive insights, harvest records and laboratory evidence in one accountable honey journey.</p>
          <div className="hero-actions"><a className="button-primary" href="#journey">Follow the journey <ArrowRight size={18} /></a><Link className="button-text" href="/dashboard">Explore the portal <ArrowUpRight size={17} /></Link></div>
          <div className="hero-caption"><Leaf size={17} /><span>Built for beekeeper clusters. Accessible through WhatsApp.</span></div>
        </div>
        <div className="hero-product"><span className="product-index">01—06 / HIVE TO JAR</span><HiveScene compact /><div className="product-footnote"><span>FIELD INTELLIGENCE</span><span>CONNECTED PROVENANCE</span></div></div>
      </section>
      <div className="product-principles"><span><Radio size={19} /> Listen to the hive</span><span><FlaskConical size={19} /> Identify the evidence</span><span><Fingerprint size={19} /> Follow every handover</span><span><ShieldCheck size={19} /> Make recalls visible</span></div>
      <ProductJourney />
      <section id="system" className="system-section content-width">
        <div className="section-intro"><p className="eyebrow">ONE CONNECTED ECOSYSTEM</p><h2>Each layer has<br />a clear job.</h2><p>Practical tools for the farmer. Accountable records for the supply chain. A readable story for the consumer.</p></div>
        <div className="system-grid">{JOURNEY.map((item, i) => { const Icon = item.icon; return <article className="system-item" key={item.tag}><div className="system-number">0{i + 1}<Icon size={21} /></div><h3>{item.title}</h3><p>{item.detail}</p><code>{item.signal}</code></article>; })}</div>
        <p className="implementation-note"><CircleDashed size={17} /> Architecture overview: BLE and MQTT require enrolled hardware and a configured gateway. Illustrations are not a claim that field devices are connected.</p>
      </section>
      <section className="farmer-section content-width">
        <div className="farmer-copy"><p className="eyebrow">A FAMILIAR FRONT DOOR</p><h2>A harvest starts<br />with a conversation.</h2><p>A farmer should be able to confirm a harvest in a familiar language. The cooperative portal connects that declaration to the rest of the batch journey.</p><ul><li><CircleCheck size={17} /> Text and voice support through WhatsApp</li><li><CircleCheck size={17} /> Clear quantity confirmation before recording</li><li><CircleCheck size={17} /> No crypto purchase required for the farmer</li></ul>{wa ? <a className="button-primary" href={wa} target="_blank" rel="noreferrer">Open WhatsApp <MessageCircle size={18} /></a> : <Link className="button-primary" href="/dashboard/login">Open your account <ArrowRight size={18} /></Link>}</div>
        <div className="conversation" aria-label="Illustrative farmer confirmation conversation"><div className="conversation-top"><MessageCircle size={24} /><div>Forager<small>Illustrative interaction</small></div><span className="status-dot" /></div><div className="chat-message incoming">Namaste. What would you like to record today?</div><div className="chat-message outgoing">A 25 kg multiflora honey harvest.</div><div className="chat-message incoming">Please confirm:<br /><strong>25 kg = 25,000 grams</strong><br />Multiflora honey. Your record will show whether blockchain registration is pending or confirmed.</div><div className="chat-confirm">Confirm harvest <CircleCheck size={16} /></div><p>This example demonstrates the intended workflow. It is not a live message.</p></div>
      </section>
      <section id="evidence" className="evidence-section">
        <div className="content-width evidence-layout"><div><p className="eyebrow">TRUST HAS DETAILS</p><h2>A record you can inspect.<br />A claim you can question.</h2><p>A blockchain can make a signed commitment inspectable. Honey purity still depends on proper sampling, laboratory testing and physical custody.</p><Link className="button-text" href="/dashboard">Inspect batch records <ArrowUpRight size={17} /></Link></div><div className="evidence-list">{[
          ['01', 'Who recorded it?', 'Actor identity, role and an attributable event.'],
          ['02', 'Does the file match?', 'Metadata and report bytes checked against their commitments.'],
          ['03', 'How much was packaged?', 'Declared harvest mass reconciled with jar inventory.'],
          ['04', 'Is there a warning?', 'Recall status and evidence availability shown separately.'],
        ].map(([n, title, description]) => <div className="evidence-row" key={n}><span>{n}</span><div><h3>{title}</h3><p>{description}</p></div><ArrowUpRight size={18} /></div>)}</div></div>
      </section>
      <section id="verify" className="verify-section content-width"><div><p className="eyebrow">FROM LABEL TO EVIDENCE</p><h2>Know the jar.<br />Check the record.</h2><p>Scan a serialized label to check that label. A batch-code lookup shows batch information and does not authenticate a physical jar.</p></div><form className="batch-search" action="/verify" method="get"><label htmlFor="public-batch">Look up a batch code</label><div><input id="public-batch" name="b" value={batch} onChange={event => setBatch(event.target.value)} placeholder="HC-2026-…" required maxLength={100} /><button type="submit" aria-label="Look up batch"><ArrowRight size={23} /></button></div><p>For jar verification, use the full signed QR link printed on the label.</p></form></section>
      <section className="network-footer content-width"><span className="eyebrow">CONFIGURED NETWORK / {networkName}</span><p>{isLocal ? 'Local development network. No public explorer is available.' : 'Testnet configuration is not proof of a live or verified deployment.'}</p>{contractAddress ? explorerUrl ? <a href={explorerUrl} target="_blank" rel="noreferrer">{contractAddress}<ArrowUpRight size={14} /></a> : <code>{contractAddress}</code> : <span>No contract configured</span>}</section>
    </main>
    <footer className="product-footer content-width"><Link className="product-brand" href="/">pollinator<span className="brand-dot">.</span></Link><p>Better visibility, from hive to honey.</p><span>Honey Chain · Prototype</span></footer>
  </div>;
}
