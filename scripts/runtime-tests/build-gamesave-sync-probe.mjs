import path from 'node:path';

export function saveSyncProbeBuild({ source, build, tests, project }) {
  return {
    command: path.join(build, 'tools/winegcc/winegcc'),
    output: path.join(tests, 'gamesave-sync-probe.exe'),
    args: ['-b', 'x86_64-w64-mingw32', '--wine-objdir', build,
      '-D__WINESRC__', '-D_UCRT', '-O2', '-Wall',
      '-I', path.join(build, 'dlls/xgameruntime'), '-I', path.join(source, 'dlls/xgameruntime'),
      '-I', path.join(build, 'include'), '-I', path.join(source, 'include'),
      '-isystem', path.join(source, 'include/msvcrt'),
      path.join(project, 'scripts/runtime-tests/gamesave-sync-probe.c'),
      '-o', path.join(tests, 'gamesave-sync-probe.exe'),
      '-lwinecrt0', '-lucrtbase', '-lkernel32', '-lntdll', '-lole32', '-lbcrypt'],
  };
}

export function buildSaveSyncProbe(options, run) {
  const probe = saveSyncProbeBuild(options);
  run(probe.command, probe.args, options.project);
  const headers = run('x86_64-w64-mingw32-objdump', ['-p', probe.output], options.project, true);
  const imports = [...headers.matchAll(/DLL Name:\s*(\S+)/g)].map(match => match[1].toLowerCase());
  if (!imports.includes('ucrtbase.dll') || imports.some(name => /^(?:msvcrt|msvcr\d+)\.dll$/.test(name)))
    throw Error('Save sync probe must use Wine UCRT without legacy MSVCRT imports');
}
