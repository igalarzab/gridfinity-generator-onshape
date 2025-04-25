/**
 * 
 * Gridfinity Generator for Onshape
 * ================================
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
 * Global Variables.
 * 
 * Changing any of these will make your part to be not-Gridfinity compliant
 *
 */

const Dims = {
    unitSize: 42 * millimeter,
    unitHeight: 7 * millimeter,
    unitClearance: 0.25 * millimeter,
    
    bottomSize: 35.6 * millimeter,
    bottomClearance: 0.00 * millimeter,
    bottomFillet: 0.8 * millimeter,
    bottomHoleClearance: 4.8 * millimeter,
    
    bottomMagnetRadius: 3.25 * millimeter,
    bottomMagnetDepth: 2.4 * millimeter,
        
    baseLayer1Height: 0.8 * millimeter,
    baseLayer2Height: 1.8 * millimeter,
    baseLayer3Height: 2.15 * millimeter,
    baseLayer4Height: 2.25 * millimeter,
    baseDraftAngle: 45 * degree,
    
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
        const base = baseCreate(context, definition, id + 'Base');
        const body = bodyCreate(context, definition, id + 'Body', base);
        
        // Rename the part
        setProperty(context, {
            'entities' : qCreatedBy(base.id, EntityType.BODY),
            'propertyType' : PropertyType.NAME,
            'value' : 'Gridfinity Bin ' ~ definition.rows ~ 'x' ~ definition.columns
        });
    }
);


/**
 * 
 * Functions to create the base of the bin
 *
 */
 
function baseCreate(context is Context, definition is map, id is Id) {
    const baseSketch = baseSketch(context, definition, id + 'BaseSketch');

    const layer1Extrude = wallExtrude(context, id + 'Layer1Extrude', baseSketch.region, {
        depth: Dims.baseLayer1Height,
        filletRadius: Dims.bottomFillet,
        draftAngle: Dims.baseDraftAngle,
    });
    
    const layer2Extrude = wallExtrude(context, id + 'Layer2Extrude', layer1Extrude.topFace, {
        depth: Dims.baseLayer2Height,
    });

    const layer3Extrude = wallExtrude(context, id + 'Layer3Extrude', layer2Extrude.topFace, {
        depth: Dims.baseLayer3Height,
        draftAngle: Dims.baseDraftAngle,
    });
    
    // Merge the three layers of the base into a single part
    const basePart = mergeParts(context, id + 'BasePart', [
        layer1Extrude.id,
        layer2Extrude.id,
        layer3Extrude.id,
    ]);
    
    // Create the magnets if needed
    if (definition.magnets) {
        const baseHolesSketch = baseHolesSketch(context, id + 'Magnets', definition);
        
        const magnets = wallExtrude(context, id + 'MagnetsExtrude', baseHolesSketch.region, {
            depth: Dims.bottomMagnetDepth,
        });
        
        substractParts(context, id + 'MagnetsHole', basePart.id, [magnets.id]);
        removeBodies(context, id + 'DeleteMagnetsSketch', [baseHolesSketch.id]);
    }
    
    // Replicate the base for rows * columns
    var linearPatternId = undefined;
    if (definition.rows > 1 || definition.columns > 1) {
        linearPatternId = id + 'ReplicateBases';
        
        linearPattern(context, linearPatternId, {
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
    }
    
    // Layer 4 is common to all the bases, that's why we do it after the linearPattern
    // After this common layer is created, we can merge all the bases in one
    const layer4Sketch = baseLayer4Sketch(
        context, 
        definition, 
        id + 'Layer4Sketch', 
        layer3Extrude.topFace
    );
    
    const layer4Extrude = wallExtrude(context, id + 'Layer4Extrude', layer4Sketch.region, {
        depth: Dims.baseLayer4Height,
        filletRadius: Dims.bodyFillet,
    });
    
    // Merge all the bases into a single part
    const allBases = mergeParts(context, id + 'AllBases', [
        linearPatternId,
        basePart.id,
        layer4Extrude.id,
    ]);

    // Remove sketches, they are not needed anymore
    removeBodies(context, id + 'DeleteBaseSketches', [baseSketch.id, layer4Sketch.id]);
    
    return { 'id': allBases.id, 'topFace': layer4Extrude.topFace };
}


function baseSketch(context is Context, definition is map, id is Id) {
    const sketchId = id + 'Sketch';
    
    const sketch = newSketch(context, sketchId, {
        'sketchPlane' : Planes.top,
    });
    
    const bottomSize = Dims.bottomSize - Dims.bottomClearance;

    // FIXME
    const translateX = (bottomSize / 2);
    const translateY = (bottomSize / 2);

    skRectangle(sketch, 'bottomSketchRectangle', {
        'firstCorner': vector(-translateX, -translateY),
        'secondCorner': vector(bottomSize - translateX, bottomSize - translateY)
    });
    
    skSolve(sketch);
    
    return { 'id': sketchId, 'sketch': sketch, 'region': qSketchRegion(id, false) };
}


function baseHolesSketch(context is Context, id is Id, definition is map) {
    const sketchId = id + 'Sketch';
    
    const sketch = newSketch(context, sketchId, {
        'sketchPlane' : Planes.top,
    });
    
    const x = (Dims.bottomSize / 2) - Dims.bottomHoleClearance;
    const y = -(Dims.bottomSize / 2) + Dims.bottomHoleClearance;
    
    skCircle(sketch, 'bottomRight', { 'center' : vector(x, x), 'radius' : Dims.bottomMagnetRadius });
    skCircle(sketch, 'topRight', { 'center' : vector(x, y), 'radius' : Dims.bottomMagnetRadius });
    skCircle(sketch, 'bottomLeft', { 'center' : vector(y, x), 'radius' : Dims.bottomMagnetRadius });
    skCircle(sketch, 'topLeft', { 'center' : vector(y, y), 'radius' : Dims.bottomMagnetRadius });
    
    skSolve(sketch);
    
    return { 'id': id, 'sketch': sketch, 'region': qSketchRegion(id, false) };
}


function baseLayer4Sketch(context is Context, definition is map, id is Id, topFace is map) {
    const sketchId = id + 'Sketch';
    
    const tangentPlane = evFaceTangentPlane(context, {
        'face': topFace,
        'parameter': vector(0.5, 0.5),
    });
    
    const sketch = newSketchOnPlane(context, sketchId, {
        'sketchPlane' : tangentPlane
    });
    
    const totalUnitClearance = Dims.unitClearance * 2;
    
    const totalX = (Dims.unitSize * definition.rows) - totalUnitClearance;
    const totalY = (Dims.unitSize * definition.columns) - totalUnitClearance;

    const bottomSize = Dims.bottomSize - Dims.bottomClearance;
    
    // FIXME
    const translateX = (bottomSize / 2) + Dims.baseLayer1Height + Dims.baseLayer3Height;
    const translateY = (bottomSize / 2) + Dims.baseLayer1Height + Dims.baseLayer3Height;

    skRectangle(sketch, 'rectangle', {
        'firstCorner': vector(- translateX, -translateY),
        'secondCorner': vector(totalX - translateX, totalY - translateY)
    });

    skSolve(sketch);

    return { 'id': sketchId, 'sketch': sketch, 'region': qSketchRegion(id, false) };
}


/**
 * 
 * Functions to create the body of the bin
 *
 */
 
function bodyCreate(context is Context, definition is map, id is Id, base is map) {
    const bodyExtrude = wallExtrude(context, id + 'BodyExtrude', base.topFace, {
        depth: Dims.unitHeight * (definition.height - 1),
    });
    
    const topExtrude = wallExtrude(context, id + 'TopExtrude', bodyExtrude.topFace, {
        depth: Dims.topHeight,
    });
    
    // Merge all the parts together
    const bin = mergeParts(context, id + 'AllBodies', [
        base.id,
        bodyExtrude.id,
        topExtrude.id,
    ]);
    
    return { 'id': bin.id, 'topFace': topExtrude.topFace };
}


/**
 * 
 * Helper functions
 *
 */
 
 function wallExtrude(context is Context, id is Id, face is Query, config is map) {
    const extrudeId = id + 'Extrude';

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
        
        opFillet(context, id + 'Fillet', {
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

        opDraft(context, id + 'Draft', {
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
    var firstPartId = undefined;
    
    for (var partId in partIds) {
        if (partId != undefined) {
            parts = append(parts, qCreatedBy(partId, EntityType.BODY));
            
            if (firstPartId == undefined) {
                firstPartId = partId;
            }
        }
    }

    opBoolean(context, id + 'Union', {
        operationType: BooleanOperationType.UNION,
        tools: qUnion(parts)
    });

    // In an union, no new part is created, so we return the first part that's defined
    return { 'id': firstPartId };
}


function substractParts(context is Context, id is Id, targetId is Id, partIds is array) {
    var parts = [];
    var firstPartId = undefined;
    
    for (var partId in partIds) {
        if (partId != undefined) {
            parts = append(parts, qCreatedBy(partId, EntityType.BODY));
            
            if (firstPartId == undefined) {
                firstPartId = partId;
            }
        }
    }
    
    opBoolean(context, id + 'Substract', {
        operationType: BooleanOperationType.SUBTRACTION,
        targets: qCreatedBy(targetId, EntityType.BODY),
        tools: qUnion(parts)
    });

    // In a removal, no new part is created, so we return the first part that's defined
    return { 'id': firstPartId };
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


function removeBodies(context is Context, id is Id, idsToRemove is array) {
    var finalIds = [];

    for (var idToRemove in idsToRemove) {
        if (idToRemove != undefined) {
            finalIds = append(finalIds, qCreatedBy(idToRemove, EntityType.BODY));
        }
    }
        
    opDeleteBodies(context, id + 'DeleteBodies', {
        entities: qUnion(finalIds)
    });
}