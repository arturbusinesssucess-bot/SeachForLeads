import * as React from 'react';
import {createRoot} from 'react-dom/client';
import RidgelineDitherFooter from './components/ui/ridgeline-dither-footer';
export function LandingFooter() {
 return <RidgelineDitherFooter
  preset="glacier" seed={23} ridges={7}
  name="SearchForLeads" brandHref="/#top"
  logo={<img src="/public/loupe-logo.svg" width="30" height="30" alt="" />}
  tagline="Expedition planning for teams who go further — routes, permits and weather in one place."
  columns={[
   {title:'Produto',links:[{label:'Como funciona',href:'#como-funciona'},{label:'Recursos',href:'#recursos',badge:'New'},{label:'Prévia de leads',href:'#top'}]},
   {title:'Ajuda',links:[{label:'Dúvidas frequentes',href:'#duvidas'},{label:'Fale com a gente',href:'mailto:contato@searchforleads.com'},{label:'Entrar na conta',href:'/auth?mode=login'}]},
   {title:'Conta',links:[{label:'Criar conta',href:'/auth?mode=signup'},{label:'Meu espaço',href:'/app/'},{label:'Voltar ao topo',href:'#top'}]}
  ]}
  socials={[{icon:'instagram',href:'https://instagram.com'},{icon:'youtube',href:'https://youtube.com'},{icon:'github',href:'https://github.com/arturbusinesssucess-bot/SeachForLeads'}]}
  credit={null}
 />;
}
if (typeof document !== 'undefined') {
 const mount = document.getElementById('ridgeline-footer');
 if (mount) createRoot(mount).render(<LandingFooter/>);
}
