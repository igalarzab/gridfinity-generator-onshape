/**
 * 
 * Gridfinity for Onshape
 * ======================
 * 
 * Gridfinity is an original idea developed by Zach Freedman
 * <https://www.youtube.com/@ZackFreedman>
 * 
 * Adaptation to Onshape (this project) done by Jose Galarza
 * <https://github.com/igalarzab/gridfinity-onshape/>
 * 
 * This work is licensed under Creative Commons Attribution-ShareAlike 4.0
 * <https://creativecommons.org/licenses/by-sa/4.0/>
 * 
 */

FeatureScript 2625;

import(path: 'onshape/std/common.fs', version: '2625.0');
import(path: 'onshape/std/geometry.fs', version: '2625.0');


/**
 * 
 * Global Variables
 *
 */
 
const Dims = {
    unitSize: 42 * millimeter,
    unitHeight: 7 * millimeter,
    unitClearance: 0.25 * millimeter,
    
    bottomSize: 35.6 * millimeter,
    bottomClearance: 0.00 * millimeter,
    bottomFillet: 0.8 * millimeter,
    
    baseLayer1Height: 0.8 * millimeter,
    baseLayer2Height: 1.8 * millimeter,
    baseLayer3Height: 2.15 * millimeter,
    baseLayer4Height: 2.25 * millimeter,
    
    bodyFillet: 3.75 * millimeter,
    
    topHeight: 4.4 * millimeter,
};


const Planes = {
    top: qCreatedBy(makeId('Top'), EntityType.FACE),
    right: qCreatedBy(makeId('Right'), EntityType.FACE),
    front: qCreatedBy(makeId('Front'), EntityType.FACE),
};


/**
 * 
 * Feature Definition
 *
 */
 
annotation { 'Feature Type Name' : 'Gridfinity Bin', 'Feature Type Description' : 'Create a gridfinity bin' }
export const gridfinityBin = defineFeature(function(context is Context, id is Id, definition is map)
    precondition
    {
        annotation { 'Group Name' : 'Bin Size', 'Collapsed By Default' : false }
        {
            annotation { 'Name' : 'Rows', 'UIHint' : [UIHint.REMEMBER_PREVIOUS_VALUE] }
            isInteger(definition.rows, POSITIVE_COUNT_BOUNDS);

            annotation { 'Name' : 'Columns', 'UIHint' : [UIHint.REMEMBER_PREVIOUS_VALUE] }
            isInteger(definition.columns, POSITIVE_COUNT_BOUNDS);

            annotation { 'Name' : 'Height', 'UIHint' : [UIHint.REMEMBER_PREVIOUS_VALUE] }
            isInteger(definition.height, { (unitless) : [2, 6, 100] } as IntegerBoundSpec);
        }

        annotation { 'Group Name' : 'Bin Properties', 'Collapsed By Default' : false }
        {
            annotation { 'Name' : 'Fill the bin', 'UIHint' : [UIHint.REMEMBER_PREVIOUS_VALUE] }
            definition.filled is boolean;

            annotation { 'Name' : 'Add Magnets', 'Default': true, 'UIHint' : [UIHint.REMEMBER_PREVIOUS_VALUE] }
            definition.magnets is boolean;

            if (!definition.filled) {
                annotation { 'Name' : 'Add Label', 'Default': true, 'UIHint' : [UIHint.REMEMBER_PREVIOUS_VALUE] }
                definition.label is boolean;

                annotation { 'Name' : 'Add Finger Slide', 'Default': true, 'UIHint' : [UIHint.REMEMBER_PREVIOUS_VALUE] }
                definition.fingerSlide is boolean;
            }
        }

    }
    {
        const base = baseCreate(context, definition, id + 'base');
        const body = bodyCreate(context, definition, id + 'body', base);
        
        // Rename the part
        setProperty(context, {
            'entities' : qCreatedBy(base.id, EntityType.BODY),
            'propertyType' : PropertyType.NAME,
            'value' : 'Gridfinity Bin'
        });
    }
);


/**
 * 
 * Functions to create the base of the bin
 *
 */
 
function baseCreate(context is Context, definition is map, id is Id) {
    const baseSketch = baseSketch(context, definition, id + 'baseSketch');

    const baseLayer1Extrude = wallExtrude(context, id + 'baseLayer1Extrude', baseSketch.region, {
        depth: Dims.baseLayer1Height,
        filletRadius: Dims.bottomFillet,
        draftAngle: 45 * degree
    });
    
    const baseLayer2Extrude = wallExtrude(context, id + 'baseLayer2Extrude', baseLayer1Extrude.topFace, {
        depth: Dims.baseLayer2Height,
    });

    const baseLayer3Extrude = wallExtrude(context, id + 'baseLayer3Extrude', baseLayer2Extrude.topFace, {
        depth: Dims.baseLayer3Height,
        draftAngle: 45 * degree
    });

    const baseLayer4Extrude = wallExtrude(context, id + 'baseLayer4Extrude', baseLayer3Extrude.topFace, {
        depth: Dims.baseLayer4Height,
    });
    
    // Merge the base into a single part
    const basePart = mergeParts(context, id + 'merge-base', [
        baseLayer1Extrude.id,
        baseLayer2Extrude.id,
        baseLayer3Extrude.id,
        baseLayer4Extrude.id,
    ]);
    
    // Replicate the base for rows * columns
    linearPattern(context, id + 'multiple-bases', {
        'patternType': PatternType.PART,
        'entities': qCreatedBy(basePart.id, EntityType.BODY),
        'hasSecondDir': true,
        'oppositeDirectionTwo': true,
        'directionOne': Planes.right,
        'directionTwo': Planes.front,
        'distance': Dims.unitSize,
        'distanceTwo': Dims.unitSize,
        'instanceCount': definition.rows,
        'instanceCountTwo': definition.columns,
    });

    // Remove sketch
    opDeleteBodies(context, id + 'delete-bottom-sketch', {
        entities: qCreatedBy(baseSketch.id, EntityType.BODY)
    });
    
    return { 'id': basePart.id, 'topFace': baseLayer4Extrude.topFace };
}


function baseSketch(context is Context, definition is map, id is Id) {
    const sketch = newSketch(context, id, {
        'sketchPlane' : Planes.top,
    });
    
    const bottomSize = Dims.bottomSize - Dims.bottomClearance;

    const translateX = (bottomSize / 2); // FIXME
    const translateY = (bottomSize / 2);

    skRectangle(sketch, 'bottomSketchRectangle', {
        'firstCorner': vector(-translateX, -translateY),
        'secondCorner': vector(bottomSize - translateX, bottomSize - translateY)
    });

    skSolve(sketch);

    return { 'id': id, 'sketch': sketch, 'region': qSketchRegion(id, true) };
}


/**
 * 
 * Functions to create the body of the bin
 *
 */
 
function bodyCreate(context is Context, definition is map, id is Id, base is map) {
    const bodySketch = bodySketch(context, definition, id + 'bodySketch', base);
    
    const bodyExtrude = wallExtrude(context, id + 'body', bodySketch.region, {
        depth: Dims.unitHeight * (definition.height - 1),
        filletRadius: Dims.bodyFillet,
    });
    
    const topExtrude = wallExtrude(context, id + 'top', bodyExtrude.topFace, {
        depth: Dims.topHeight,
    });
}


function bodySketch(context is Context, definition is map, id is Id, base is map) {
    const tangentPlane = evFaceTangentPlane(context, {
        'face': base.topFace,
        'parameter': vector(0.5, 0.5),
    });
    
    const sketch = newSketchOnPlane(context, id + 'body-sketch', {
        'sketchPlane' : tangentPlane
    });
    
    const totalUnitClearance = Dims.unitClearance * 2;
    
    const totalX = (Dims.unitSize * definition.rows) - totalUnitClearance;
    const totalY = (Dims.unitSize * definition.columns) - totalUnitClearance;

    // TODO
    const bottomSize = Dims.bottomSize - Dims.bottomClearance;
    const translateX = (bottomSize / 2) + Dims.baseLayer1Height + Dims.baseLayer3Height;
    const translateY = (bottomSize / 2) + Dims.baseLayer1Height + Dims.baseLayer3Height;

    skRectangle(sketch, 'bottomSketchRectangle', {
        'firstCorner': vector(- translateX, -translateY),
        'secondCorner': vector(totalX - translateX, totalY - translateY)
    });

    skSolve(sketch);

    return { 'id': id, 'sketch': sketch, 'region': qSketchRegion(id, true) };
}


/**
 * 
 * Helper functions
 *
 */
 
 function wallExtrude(context is Context, id is Id, face is Query, config is map) {
    const extrudeId = id + 'extrude';

    opExtrude(context, extrudeId, {
        'entities' : face,
        'direction' : evPlane(context, {'face' : Planes.top}).normal,
        'endBound' : BoundingType.BLIND,
        'endDepth' : config.depth
    });
    
    if (config.filletRadius != undefined) {
        const edges = qParallelEdges(
            qCreatedBy(id, EntityType.EDGE),
            evPlane(context, {'face' : Planes.top}).normal
        );
        
        opFillet(context, id + 'fillet', {
            'entities' : edges,
            'radius' : config.filletRadius
        });
    }

    if (config.draftAngle != undefined) {
        const rightFaces = qParallelPlanes(
            qCreatedBy(extrudeId, EntityType.FACE),
            evPlane(context, {'face' : Planes.right})
        );

        const frontFaces = qParallelPlanes(
            qCreatedBy(extrudeId, EntityType.FACE),
            evPlane(context, {'face' : Planes.front})
        );

        opDraft(context, id + 'draft', {
            'draftType' : DraftType.REFERENCE_SURFACE,
            'draftFaces' : qUnion(rightFaces, frontFaces),
            'referenceSurface': face,
            'pullVec' : vector(0, 0, -1),
            'angle' : config.draftAngle
        });
    }

    return { 'id': extrudeId, 'topFace': findTopFace(context, extrudeId) };
}

 
function mergeParts(context is Context, id is Id, partIds is array) {
    var parts = [];

    for (var partId in partIds) {
        parts = append(parts, qCreatedBy(partId, EntityType.BODY));
    }

    opBoolean(context, id + 'merge', {
        operationType: BooleanOperationType.UNION,
        tools: qUnion(parts)
    });

    // In an union on new part is created, so we return partIds[0]
    return { 'id': partIds[0] };
}


function findTopFace(context is Context, id is Id) {
    const allFaces = evaluateQuery(context, qCreatedBy(id, EntityType.FACE));

    for (var f in allFaces) {
        const plane = evFaceTangentPlane(context, { 'face': f, parameter: vector(0.5, 0.5) });

        if (plane.normal == vector(0, 0, 1)) {
            return f;
        }
    }
    
    debug(context, 'No top face found for ' ~ id);
    debug(context, allFaces);
    
    return undefined;
}