import asyncio, json, subprocess
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
    root='/workspace/worktrees/replay'
    evidence={'head': subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'delta':subprocess.check_output(['git','diff','--stat'],cwd=root,text=True)}
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
        page=await browser.new_page(viewport={'width':1280,'height':960})
        await page.goto('http://127.0.0.1:4175/')
        await page.get_by_test_id('import-video').set_input_files([f'{root}/tests/coach/generated/source.mp4',f'{root}/tests/coach/generated/comparison-second.mp4'])
        await page.wait_for_function("document.querySelectorAll('.collection button').length === 2")
        await page.get_by_label('Vídeo A',exact=True).select_option(label='source.mp4')
        await page.get_by_label('Vídeo B',exact=True).select_option(label='comparison-second.mp4')
        await page.get_by_role('button',name='Reproduzir comparação',exact=True).wait_for(state='visible')
        await page.wait_for_function("Array.from(document.querySelectorAll('.comparison-panel button')).find(b=>b.textContent==='Reproduzir comparação')?.disabled === false")
        await page.evaluate("""() => { const b=document.querySelector('[data-testid=compare-b]'); b.play=()=>new Promise(()=>{}); }""")
        await page.get_by_role('button',name='Reproduzir comparação',exact=True).click()
        await page.wait_for_timeout(1200)
        evidence['controlled_failure']='B play promise deliberately held pending; A uses actual Chromium playback'
        evidence['pending']=await page.evaluate("""() => ({aTime:document.querySelector('[data-testid=compare-a]').currentTime,bTime:document.querySelector('[data-testid=compare-b]').currentTime,aPaused:document.querySelector('[data-testid=compare-a]').paused,bPaused:document.querySelector('[data-testid=compare-b]').paused,buttons:Array.from(document.querySelectorAll('.comparison-panel button')).map(x=>({text:x.textContent,disabled:x.disabled}))})""")
        await page.locator('.comparison-panel').screenshot(path='/workspace/sprint/review/comparison-startup-fixed.png')
        await page.get_by_role('button',name='Cancelar início da comparação',exact=True).click()
        evidence['cancelled']=await page.locator('.comparison-panel video').evaluate_all('(vs)=>vs.every(v=>v.paused)')
        assert evidence['cancelled']
        await page.get_by_role('button',name='Reproduzir comparação',exact=True).click()
        await page.wait_for_timeout(2500)
        evidence['timeout']=await page.locator('.comparison-panel').evaluate('(p)=>({paused:Array.from(p.querySelectorAll("video")).every(v=>v.paused),notice:p.querySelector("[role=status]").textContent})')
        assert evidence['timeout']['paused'] and 'não iniciou' in evidence['timeout']['notice']
        await page.get_by_label('Vídeo B',exact=True).select_option('')
        evidence['after_source_clear']=await page.locator('[data-testid=compare-a]').count()
        await browser.close()
    Path('/workspace/sprint/review/comparison-startup-fixed.json').write_text(json.dumps(evidence,indent=2))
    print(json.dumps(evidence,indent=2))
asyncio.run(main())
