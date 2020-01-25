THREE.MetaBalls = function(envMap, camera, blobs, maxBlobs, rect) {
	var texture = new THREE.Texture();
	var raymarch = `
		uniform int numBlobs, steps;
		uniform vec3 blobs[maxBlobs], blobs1[maxBlobs];
		uniform float blobs2[maxBlobs];
		uniform float test, k, minD;
		varying vec3 vNear, vFar;
		varying vec4 vPoint;
		varying float vMaxL;
		int n;

		float capsule( vec3 pa, vec3 ba, float ba2) {
		    float h = clamp( dot(pa,ba)/ba2, 0.0, 1.0 );
		    return length( pa - ba*h );
		}

		float world(vec3 at) {
			float sum = 0.;
			for (int i = 0; i < maxBlobs; i++) {
				if (i==numBlobs) break;
				sum += exp(-.022*capsule(-at+blobs[i], blobs1[i], blobs2[i]));
			}
			return -log(sum)/k;
		}

		vec4 raymarch(in vec3 pos, in vec3 dir, in float maxL) {
			float l = 0., l0=0., d=maxL, dMin=maxL, d0, test2=minD/2.;
			for (int i = 0; i < 128; i++) {
				d0=d;
				d = world(pos + dir * l);
				if (d>0.) d=max(d, minD);
				#ifndef ISFRAG
				 if (i>0 && d>0. && d>d0 && d<dMin) {
				 	l0=l;
				 	dMin=d;
				 }
				#endif
				l += d;
				if ( abs(d)<test2 || i==steps) break;
				n=i;
				if (l > maxL) break;
			}
			#ifdef ISFRAG
			 l0=l;
			 if (n==steps && d>0. && d>d0) l=maxL;
			#else
			 if (l < maxL)  l0=l;
			#endif
			return vec4(pos + dir * l0, l);
		}`;

	var material = new THREE.ShaderMaterial({
		transparent: true,
		defines: {
			maxBlobs: maxBlobs
		},
		extensions: {derivatives: 1},
		uniforms: {
			envMap: {value: envMap},
			blobs: {value: blobs[0]},
			blobs1: {value: blobs[1]},
			blobs2: {value: blobs[2]},
			numBlobs: {value: 6},
			invMatrix: {value: new THREE.Matrix4()},
			stepsFrag: {value: 64},
			stepsVert: {value: 20},
			test: {value: 20},
			k: {value: .022},
			minD: {value: .4}
		}, //
		vertexShader: `
		uniform mat4 invMatrix;

		` + raymarch.replace(/steps/g, 'stepsVert').replace('abs(d)<test2', '(d)<test') +`

		void main() {
			gl_Position = vec4( position.xy, -1., 1.0 );
			vec4 far = (invMatrix * vec4( position.xy, 1.0, 1.0 ));
			vec4 near = (invMatrix * vec4( position.xy, -1.0, 1.0 ));
			vNear = near.xyz / near.w;
			vFar = far.xyz / far.w;

			vec3 dir0 = vFar - cameraPosition, dir = normalize(dir0), dist, point;
			vMaxL = length(dir0); //, maxL2=maxL*maxL, dist2; //test2 = test*test;
			vPoint = raymarch(cameraPosition, dir, vMaxL);
		}`,
		fragmentShader: `
		#define PI 3.14159265359
		#define PI2 6.28318530718
		#define PI_HALF 1.5707963267949
		#define RECIPROCAL_PI 0.31830988618
		#define RECIPROCAL_PI2 0.15915494
		#define LOG2 1.442695
		#define ISFRAG

		uniform sampler2D envMap;
		uniform mat4 invMatrix;

		` + raymarch.replace(/steps/g, 'stepsFrag') +`

		float draw = 0.;

			const float eps = 0.1;

			const vec3 v1 = vec3( eps,-eps,-eps);
			const vec3 v2 = vec3(-eps,-eps, eps);
			const vec3 v3 = vec3(-eps, eps,-eps);
			const vec3 v4 = vec3( eps, eps, eps);
		vec3 normal(vec3 pos) {
			//float wpos = world(v1);
			return normalize( v1*world( pos + v1 ) + 
							  v2*world( pos + v2 ) + 
							  v3*world( pos + v3 ) + 
							  v4*world( pos + v4 ) );
		}

		void main() {
			if (vPoint.w >= vMaxL) discard;
			vec3 dir = normalize(vFar - cameraPosition), dist, norm;
			float intensity = 0., maxL = vPoint.w; //, maxL2=maxL*maxL, dist2; //test2 = test*test;
			vec4 point = raymarch(vPoint.xyz, dir, maxL);
			if (point.w >= maxL) discard;
			else norm=normal(point.xyz);

			//draw = 1.;
			// vec3 X = dFdx(point.xyz);
			// vec3 Y = dFdy(point.xyz);
			// vec3 norm=normalize(cross(X,Y));
			//gl_FragColor=vec4(1.);
			float normDir = -dot(norm, dir);
			if (normDir>0.) dir = reflect( dir, norm );
			float UVy = asin( clamp( dir.y, -1., 1. ) ) * RECIPROCAL_PI + 0.5;
			float UVx = asin( dir.z/length(dir.xz) ) * RECIPROCAL_PI2 + 0.5;
			//float val=float(n)/float(stepsFrag);
			gl_FragColor = texture2D( envMap, vec2(UVx, UVy) );
			
			//gl_FragColor.a = smoothstep(0., fwidth(vPoint.w), normDir);
			//if (point!=vPoint) gl_FragColor.b=.5;

		}`

	});
	var metaBalls = new THREE.Mesh(new THREE.PlaneGeometry(2,2, Math.round(rect.x/10), Math.round(rect.y/10)), material);
	metaBalls.setN = function(n) {
		material.uniforms.numBlobs.value = n;
	};
	metaBalls.onBeforeRender = function(){
		material.uniforms.invMatrix.value.multiplyMatrices(camera.matrixWorld, camera.projectionMatrixInverse);
	};
	metaBalls.resize=function(rect){
		metaBalls.geometry = new THREE.PlaneBufferGeometry(2,2, Math.round(rect.x/10), Math.round(rect.y/10))
	}

	return metaBalls
};
